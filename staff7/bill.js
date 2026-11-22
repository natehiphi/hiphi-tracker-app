// Staff7's bill page (R-398). Part A: the band, HIPHI's position and who leads, where the bill stands (two plain lines), the path drawing and the bill's facts (what it does, issue, committees, companions,
// sponsors). Everything here is worked out from data already in memory, and the words for dates and states come from the SAME helpers the Issues list uses (hearTxt, whenWords, deadlineOf, isAtRisk, clearedOf,
// place.js, testimonyDue, bill_words.js), so the list and this page never disagree. Looking never changes anything: only a bill on one of the viewer's own issues has a link to one of their steps.
// Part B (Team notes, Past hearings, History) is bill_history.js, drawn after the facts; Part C (Change position or lead, Add a note) is bill_edit.js.
import { S, capitolUrl } from '../staff6/data.js';
import { hearingAhead, stopOf, roomName, companionsOf, billRef } from '../staff6/model.js';
import { whoseStep } from '../staff6/steps.js';
import { ic } from './icons7.js';
import { esc, btn } from './parts.js';
import { billName, billNo, posWords, first, lateLine } from './steps.js';
import { isAlive, deadlineOf, isAtRisk } from './standing.js';
import { whenWords, dateWords } from './words.js';
import { norm } from './find.js';
import { cap, testimonyDue, letterState, testimonyShort, leadIds, http, draftFor, cmtesLinks, ext } from './bill_words.js';
import { billTimeline } from './bill_tl.js';
import { isNoLead } from './team_data.js';   // R-398 piece 6: the Team door on a bill nobody leads
import { billTextUrl, afterHTML, moreAfterHTML, chairsHTML, askedWords, publicHTML, talkingHTML, bindMore } from './bill_more.js';
import { partB, bindPartB } from './bill_history.js';
import { chairLineHTML, bindChairLine } from './bill_chair.js';
import { askForBill } from './ask_data.js';
import { stoppedWords } from './issue_table.js';
import { placeLine, placeLineHTML, stoppedLineHTML } from './place.js';
import { backHref } from './bills.js';
import { editButton, editHTML, mayEdit, bindEdit, posAfterHTML } from './bill_edit.js';
import { holdFor, holdStrip } from './do_check.js';   // gap B: the position changed after approval
import { eCig, iconOf, tint, issueHref, issuesHref, noTopic, sameName, hearTxt, stepOn, clearedOf, clearedLabel, sitKeyOf, nextCtx, billHref } from './issues.js';

const enc = encodeURIComponent;
const n = (k, one, many) => `${k} ${k === 1 ? one : many}`;
const num = b => String(b.bill_number).replace(/\s/g, '');
// What is open on the page, kept across the minute's redraw in this visit only: the bills whose whole list of introducers was opened
export const bui = { all: new Set(), open: new Set(), edit: null, ctx: null, note: new Map(), noteSel: null, noteErr: false, noteBusy: false, noteOpen: null, talk: new Set(), cap: new Set() };   // talk: bills whose talking points are open; cap: bills whose "More from the Capitol’s page" is open; noteOpen: the bill whose note box is open   // all: bills whose whole list of introducers is open; open: the "Show all" lists of Part B (key: list|bill id)

// ---------------------------------------------------------------------------------- small parts
const kv = rows => `<dl class="kv bfacts" id="bFacts">${rows.filter(Boolean).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join('')}</dl>`;
// line 1 of the bill's place in bold, the rest as it is (the text is place.js placeLineHTML: already escaped)
const boldFirst = h => { const k = String(h).indexOf(' · '); return k < 0 ? `<b>${h}</b>` : `<b>${h.slice(0, k)}</b>${h.slice(k)}`; };
const chamberWord = b => /^S/i.test(String(b.bill_number || '').trim()) ? 'Senate' : 'House';
// the Capitol's own date a bill was stopped by (the m/d/yy at the end of died_deadline) as YYYY-MM-DD; '' when the data holds none
export const stoppedISO = b => { const m = /(\d+)\/(\d+)\/(\d+)\s*$/.exec(b.died_deadline || ''); if (!m) return ''; const y = +m[3] < 100 ? 2000 + +m[3] : +m[3]; return `${y}-${String(m[1]).padStart(2, '0')}-${String(m[2]).padStart(2, '0')}`; };
// ---------------------------------------------------------------------------------- back
// "Back to <issue>", or where the person came from (the address carries from=calendar or from=search)
// R-398 (Nate 20 Nov): the page no longer draws its own Back; the frame draws one top row (Back and Close). The bill only says where it would go when it was
// opened straight from a link (the natural parent): the screen it came from (from=...), else its issue, else Issues. Read by frame.js after the page is drawn.
export const billParent = { h: '#/issues', name: 'Issues' };
function backOf(issue, b, who, from, bq = '') {
  let h, name;
  if (from === 'bills') { h = backHref(bq); name = 'All bills'; }
  else if (from === 'calendar') { h = `#/calendar${who.code ? `?who=${enc(who.code)}` : ''}`; name = 'Calendar'; }
  else if (from === 'search') { h = '#/search'; name = 'Search'; }
  else if (issue) { h = issueHref(who, issue.id); name = sameName(b, issue) ? 'the issue' : eCig(issue.name); }   // a bill the team tracks that is on no issue has no issue to go back to
  else { h = issuesHref(noTopic(who)); name = 'Issues'; }
  billParent.h = h; billParent.name = name;
  return '';
}

// ---------------------------------------------------------------------------------- 1. the position and who leads
const person = id => S.advocates.find(a => a.id === id);
function leadHTML(b, issue, me) {
  if (isNoLead(b)) return 'Nobody leads this bill.';   // R-398 piece 6: the same rule as Team's "No lead yet" (team_data.js)
  const ids = leadIds(b, issue);
  if (!ids.length) return 'Nobody leads it yet';
  const names = ids.map(id => id === me?.id ? 'You' : (() => { const a = person(id); return a?.initials ? `<a class="lk" href="#/issues?who=${enc(a.initials)}">${esc(first(a))}</a>` : esc(first(a)); })());
  const j = names.length < 3 ? names.join(' and ') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  return `${j} ${names.length === 1 && ids[0] !== me?.id ? 'leads' : 'lead'}`;
}
function positionHTML(b, issue, me, can) {
  if (can && bui.edit && bui.edit.id === b.id) return editHTML(b, issue, me);   // the edit block stands in the position line's place
  const pos = b.position ? `<span class="bpos-k">HIPHI’s position</span> <b class="bpos">${esc(posWords(b))}</b>` : '<b class="bpos">No position yet</b>';
  return `<p class="bposl" id="bPos">${pos}<span class="bsep" aria-hidden="true">·</span><span id="bLead">${leadHTML(b, issue, me)}</span>${can ? editButton(isNoLead(b)) : ''}</p>${isNoLead(b) ? `<p class="tdoor"><a class="btn quiet" href="#/team/bill/${enc(b.id)}">Take it</a><a class="btn quiet" href="#/team/give/${enc(b.id)}">Give to…</a></p>` : ''}${posAfterHTML(b, me)}`;   // R-398 part 3: what the public site still says, under the position
}

// ---------------------------------------------------------------------------------- 2. where it stands
// Every coming hearing of the bill, one for each committee and time, soonest first
function aheadList(b) {
  const seen = new Set(), now = Date.now();
  return (S.hearings || []).filter(h => h.bill_id === b.id && h.status === 'scheduled' && new Date(h.scheduled_at).getTime() > now).sort((x, y) => String(x.scheduled_at).localeCompare(String(y.scheduled_at)))
    .filter(h => { const k = sitKeyOf(h); if (seen.has(k)) return false; seen.add(k); return true; });
}
const line = (html, { muted = false, id = '' } = {}) => `<p class="bln${muted ? ' m' : ''}"${id ? ` id="${id}"` : ''}><span class="blt">${html}</span></p>`;
// the page one hearing is on in Calendar, or '' when this person's calendar would not hold it (a bill on no issue that is not theirs)
function sitHref(h, who, own, onIssue) {
  const q = who.kind === 'person' || who.kind === 'all' ? `?who=${enc(who.code)}` : own ? '' : onIssue ? '?who=all' : null;
  return q == null ? '' : `#/calendar/sitting/${enc(sitKeyOf(h))}${q}`;
}
// The viewer's own step as the same tonal button the issue page has, under the lines
const mineBtn = step => step ? `<p class="bmv"><a class="btn quiet ymove" href="#/do/${enc(step.id)}">Your move · ${esc(step.verb)}</a></p>` : '';
// "waiting for Nate’s approval" / "waiting for a second look by Kris", when the data names the one person who can give it (whoseStep); else the plain state ("waiting for approval")
function testimonyState(h, b, st) {
  const dh = draftFor(h, b); if (dh && holdFor(b, dh)) return 'held until it is checked';   // gap B: never "ready to file" while the position and the testimony disagree
  const words = testimonyShort(st);
  if (st.key !== 'approve' && st.key !== 'second') return words;
  let ids = []; try { ids = whoseStep(draftFor(h, b) || null, b, { viewer: S.me, h }).ids || []; } catch { /* the plain words */ }
  if (ids.length !== 1) return words;
  const a = S.advocates.find(x => x.id === ids[0]), you = !!S.me && ids[0] === S.me.id, who = you ? 'you' : a ? first(a) : '';
  return !who ? words : st.key === 'approve' ? `waiting for ${you ? 'your' : `${who}’s`} approval` : `waiting for a second look by ${who}`;
}
// where the bill's own words say it stands, plain lines: the hearing and the testimony (and what comes after), or what it needs and who to ask, or where it is. Stopped: one line and where the issue goes on.
function statusLines(b, issue, who, open, own, nx, onIssue, others) {
  const alive = isAlive(b), step = own ? stepOn(open, b) : null, mine = mineBtn(step);
  if (!alive) {
    const al = !issue ? '' : others.length ? others.map((o, k) => line(`${k ? '' : 'Still alive for this issue: '}<a class="lk" href="${billHref(who, o, issue.id)}">${esc(`${billNo(o)}, the ${chamberWord(o)} version`)}</a> · ${placeLineHTML(o)}`, { id: k ? '' : 'bAlive' })).join('')
      : line('No other bill on this issue is still moving.', { id: 'bAlive' });
    return line(stoppedLineHTML(b, null, { link: true })) + al;   // place.js: "Stopped Feb 11 · No hearing, missed the deadline · House Health (HLT)"
  }
  const hs = aheadList(b), h = hearingAhead(b) ? hs[0] : null, out = [], row = nx && nx.next ? nx.next.row : null;
  if (h) {
    const room = roomName(h.room), notice = http(h.notice_url) ? ` · ${ext(h.notice_url, 'Agenda')}` : '', sit = sitHref(h, who, own, onIssue);
    // the page LEADS with the bill's place (place.js, the same words as every table); the hearing's own line follows without the committee or the status. "See the hearing" ends it (a link to the sitting in Calendar), unless the viewer has a step of their own to do
    out.push(line(boldFirst(placeLineHTML(b, null, { link: true }))));
    out.push(line(`<b>${esc(cap(hearTxt(h.scheduled_at)))}</b>${room ? ` · ${esc(room)}` : ''}${notice}${!step && sit ? ` · <a class="lk" href="${sit}">See the hearing</a>` : ''}`));
    const due = testimonyDue(h), st = letterState(h, b), gone = due <= Date.now(), t = hearTxt(due), accepted = new Date(h.scheduled_at).getTime() > Date.now();
    const d = draftFor(h, b), doc = d && http(d.doc_url) ? ` · ${ext(d.doc_url, 'Open the testimony')}` : '';
    // the one amber on the page, in Calendar's own words and icon: testimony that was due, is not filed and is still accepted. Once it can no longer be filed it is a plain fact.
    const tl = !gone ? `<b>Testimony due ${esc(t)}</b> · ${esc(testimonyState(h, b, st))}${doc}`
      : st.key === 'filed' ? `<b>Testimony was due ${esc(t)}</b> · filed${doc}`
      : accepted ? `<b class="riskt">${ic('triangle-alert')}${esc(lateLine(h.scheduled_at))}</b> · ${esc(testimonyState(h, b, st))}${doc}`
      : `<b>Testimony was due ${esc(t)}</b> · not filed${doc}`;
    out.push(line(tl));
    const other = hs.find(x => sitKeyOf(x) !== sitKeyOf(h));
    if (other) { const sh = sitHref(other, who, own, onIssue), w = `Another hearing ${hearTxt(other.scheduled_at)}`; out.push(line(`${sh ? `<a class="lk" href="${sh}">${esc(w)}</a>` : esc(w)} · ${cmtesLinks(other.committee, b)}`, { muted: true })); }
    const after = afterHTML(b); if (after) out.push(line(after, { muted: true }));
    return out.join('') + mine;
  }
  const dl = deadlineOf(b), cleared = !!row && clearedOf(b, row) === 'yes';
  if (dl) {
    const cm = stopOf(b).committee, risk = isAtRisk(b), said = cleared ? `${clearedLabel(row)}.` : '', chair = cm ? chairsHTML(cm) : '';
    out.push(line(boldFirst(placeLineHTML(b, null, { link: true }))));   // where it is, as every table says it
    out.push(line(`<b>Needs a hearing by ${esc(whenWords(dl.date))}</b>`));
    const l2 = [risk ? esc('If it is not heard by then, it stops for the year.') : '', chair].filter(Boolean).join(' ');
    if (l2 || (risk && said)) out.push(line(`${l2}${risk && said ? ` <span class="m">${esc(said)}</span>` : ''}`));
    if (!risk && said) out.push(line(esc(said), { muted: true }));
    const asked = cm && !askForBill(b) ? askedWords(b, cm) : '', more = moreAfterHTML(b), l3 = [asked ? `${esc(asked)}.` : '', more].filter(Boolean).join(' ');
    if (l3) out.push(line(l3, { muted: true }));
    return out.join('') + mine;
  }
  const where = placeLineHTML(b, null, { link: true });   // place.js: "Waiting for a hearing · Senate Education (EDU)"
  // in a committee with nothing scheduled and no deadline of its own to chase: the date the committee must hear it by when the Capitol's calendar gives one (never guessed)
  const cs = stopOf(b), cd = cs.deadline && !cs.deadline.missed ? cs.deadline : null;
  const none = cs.phase === 'committee' && cs.committee && cd ? line(`It must be heard by ${esc(dateWords(String(cd.date).slice(0, 10)))}.`, { muted: true }) : '';   // only what is new: the place line above already names the committee and says nothing is scheduled
  return line(boldFirst(where)) + (cleared ? line(esc(`${clearedLabel(row)}.`), { muted: true }) : '') + none + mine;   // the place leads; "Cleared Thursday’s deadline." follows
}

// ---------------------------------------------------------------------------------- 4. the facts
// A companion: its number, and where it stands when we can find it (one of our bills, or in the practice index)
function companionsHTML(b, who) {
  const nums = [...new Set(companionsOf(b))]; if (!nums.length) return '';
  const idx = S.snapshot?.index || [];
  const li = c => {
    const t = c.replace(/^([A-Z]+)(\d)/, '$1 $2'), own = (S.bills || []).find(x => num(x) === c && (!x.session_year || !b.session_year || +x.session_year === +b.session_year));
    if (own && own.tracked !== false) return `<li><a class="lk" href="${billHref(who, own, '')}">${esc(t)}</a> · ${esc(isAlive(own) ? placeLine(own) : stoppedWords(own))}</li>`;
    if (own) return `<li>${esc(t)} · ${esc(isAlive(own) ? placeLine(own) : stoppedWords(own))}</li>`;
    return idx.some(x => num(x) === c) ? `<li><a class="lk" href="#/search/other/${enc(c)}">${esc(t)}</a></li>` : `<li>${esc(t)}</li>`;
  };
  return `<ul class="blist">${nums.map(li).join('')}</ul>`;
}
// Sponsors: the first (named in full, a link when the legislator can be found), then the others behind "Show all"
const lastOf = l => norm(String(l.sort_name || l.name).split(',')[0]);
function legFor(sp, b) {
  const raw = String(sp?.n || sp?.name || sp || '').replace(/\(.*?\)/g, '').trim(), key = norm(raw), ch = /^S/i.test(num(b)) ? 'S' : 'H';
  let c = (S.legislators || []).filter(l => l.chamber === ch && lastOf(l) === key);
  if (!c.length) c = (S.legislators || []).filter(l => lastOf(l) === key);
  const l = c.length === 1 ? c[0] : null, last = l ? String(l.sort_name || l.name).split(',')[0].trim() : raw === raw.toUpperCase() ? raw.replace(/\w\S*/g, w => w[0] + w.slice(1).toLowerCase()) : raw;
  const title = (l ? l.chamber : ch) === 'S' ? 'Sen.' : 'Rep.', text = esc(`${title} ${last}`);
  return l ? `<a class="lk" href="#/search/person/${enc(l.id)}">${text}</a>` : text;
}
export function sponsorsHTML(b) {
  const sps = (b.sponsors || []).filter(s => String(s?.n || s?.name || s || '').trim()); if (!sps.length) return '';
  const all = sps.map(s => legFor(s, b)), rest = all.length - 1, open = bui.all.has(b.id);
  if (!rest) return all[0];
  return `<span data-bs="short"${open ? ' hidden' : ''}>${all[0]} and ${n(rest, 'other', 'others')}</span><span data-bs="long"${open ? '' : ' hidden'}>${all.join(', ')}</span> · ${btn(open ? 'Show fewer' : 'Show all', { kind: 'text', attrs: `data-bshow="${esc(b.id)}" aria-expanded="${open}" aria-label="${open ? 'Show fewer' : 'Show all'} introducers"` })}`;
}
function factsHTML(b, who) {
  const desc = (String(b.public_summary || '').trim() || String(b.description || '').replace(/\s+/g, ' ').trim()), sps = sponsorsHTML(b), comp = companionsHTML(b, who), talk = talkingHTML(b);
  return kv([
    desc ? ['What it does', esc(eCig(desc))] : null,
    comp ? ['Companion bills', comp] : null, sps ? ['Introduced by', sps] : null,
    ['On the public site', publicHTML(b)],
    talk ? ['Talking points', talk] : null]);
}
// the number's line in the band: "HB 1523 · The Capitol’s page ↗ · Read the bill ↗" (the two links wrap to their own line on a phone)
function numberLine(b, noNo = false) {   // noNo: opened from an issue, the number is the small line above the title instead
  const cap = capitolUrl(b), txt = billTextUrl(b), ls = [http(cap) ? ext(cap, 'The Capitol’s page') : '', http(txt) ? ext(txt, 'Read the bill') : ''].filter(Boolean);
  return `<p class="bsub">${noNo ? '' : `<span class="bno">${esc(billNo(b))}</span>`}${ls.length ? `<span class="bls">${ls.map((l, i) => `${noNo && !i ? '' : '<span class="bsep" aria-hidden="true">·</span>'}${l}`).join('')}</span>` : ''}</p>`;
}

// ---------------------------------------------------------------------------------- the page
// `x`: { nx: the session as the Issues list has it (its next deadline), from: 'calendar' | 'search' | '' }
export function billSheet(b, issue, who, me, open, others, own, x = {}) {
  const alive = isAlive(b), nx = x.nx || nextCtx(), from = x.from === 'calendar' || x.from === 'search' || x.from === 'bills' ? x.from : '';
  const onIssue = (S.billIssues || []).some(y => y.bill_id === b.id && (S.issues || []).some(i => i.id === y.issue_id && !i.archived_at));
  // Opened from an issue (the address says ?i=<that issue>): the issue is the whole, the bill a part of it. The mark is smaller and only outlined, the number is the small line above the title, and Back is the trail
  // "Issues › <issue name>". Without ?i= (or from Calendar or Search) the page is as it was.
  const fi = !!issue && !from && (new URLSearchParams((location.hash.split('?')[1] || '')).get('i') || '') === String(issue.id);
  billParent.h = issueHref(who, issue?.id); billParent.name = eCig(issue?.name);   // the natural parent of a bill opened from its issue
  let out = `<div class="pn"><div class="hband bb${fi ? ' fromissue' : ''}" style="${alive ? tint(issue) : '--ic:var(--edge)'}"><span class="imark big${fi ? ' out' : ''}" aria-hidden="true">${ic(iconOf(issue))}</span><div class="ht">${fi ? '' : backOf(issue, b, who, from, x.bq)}${fi ? `<p class="kindl no">${esc(billNo(b))}</p>` : ''}<h1 tabindex="-1">${esc(billName(b))}</h1>${numberLine(b, fi)}</div></div><div class="pbody bill">`;
  const can = mayEdit(b, issue, me); if (!(can && bui.edit && bui.edit.id === b.id)) bui.edit = null;   // an edit open on another bill, or one this person may not make, is dropped
  bui.ctx = { b, issue, me };
  out += positionHTML(b, issue, me, can) + holdStrip(b);
  if (!onIssue) out += `<p class="hint bnoiss"><span id="bNoIssue">On no issue yet</span>${btn('Put it on an issue', { kind: 'quiet', href: '#/bill-issues/' + encodeURIComponent(billRef(b)), id: 'bPutIssue' })}</p>`;   // gap C: opens "Issues for <bill>" (bill_issues.js). A bill already on an issue has its issue page for changes (Change the bills), so no button here.
  out += `<div class="bstat" id="bStat">${statusLines(b, issue, who, open, own, nx, onIssue, others)}</div>`;
  out += chairLineHTML(b);   // R-398 piece 5: where the ask to the chair stands, with the button that records the chair's reply
  out += `<div class="bigpath">${billTimeline(b)}</div>`;
  out += factsHTML(b, who);
  out += partB(b);
  return out + `</div></div>`;
}

// "Show all" on the introducers: opens the whole list in place; the state is kept for the minute's redraw
export function bindBill() {
  document.querySelectorAll('button[data-bshow]').forEach(bt => bt.addEventListener('click', () => {
    const on = bt.getAttribute('aria-expanded') !== 'true', id = bt.dataset.bshow, dd = bt.closest('dd');
    if (on) bui.all.add(id); else bui.all.delete(id);
    bt.setAttribute('aria-expanded', String(on)); bt.textContent = on ? 'Show fewer' : 'Show all'; bt.setAttribute('aria-label', `${on ? 'Show fewer' : 'Show all'} introducers`);
    dd?.querySelector('[data-bs="short"]')?.toggleAttribute('hidden', on); dd?.querySelector('[data-bs="long"]')?.toggleAttribute('hidden', !on);
  }));
  bindEdit(); bindPartB(); bindMore(); bindChairLine();
}
