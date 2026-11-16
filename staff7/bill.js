// Staff7's bill page (R-398). Part A: the band, HIPHI's position and who leads, where the bill stands (two plain lines), the path drawing and the bill's facts (what it does, issue, committees, companions,
// sponsors). Everything here is worked out from data already in memory, and the words for dates and states come from the SAME helpers the Issues list uses (hearTxt, whenWords, deadlineOf, isAtRisk, clearedOf,
// whereWords, testimonyDue, bill_words.js), so the list and this page never disagree. Looking never changes anything: only a bill on one of the viewer's own issues has a link to one of their steps.
// Part B (Team notes, Past hearings, History) is bill_history.js, drawn after the facts; Part C (Change position or lead, Add a note) is bill_edit.js.
import { S, SESSION_YEAR, capitolUrl, effStage } from '../staff6/data.js';
import { hearingAhead, stopOf, roomName, companionsOf } from '../staff6/model.js';
import { whereWords } from '../staff6/steps.js';
import { ic } from './icons7.js';
import { esc, btn } from './parts.js';
import { billName, billNo, posWords, first, lateLine } from './steps.js';
import { isAlive, deadlineOf, isAtRisk } from './standing.js';
import { dateWords, whenWords, whyWords } from './words.js';
import { billPath, pathOf } from './path.js';
import { norm } from './find.js';
import { testimonyDue, letterState, testimonyShort, leadIds, http, dateY, codesOf, cmteLink, cmtesLinks, cleanCodes } from './bill_words.js';
import { partB, bindPartB } from './bill_history.js';
import { editButton, editHTML, mayEdit, bindEdit } from './bill_edit.js';
import { eCig, iconOf, tint, issueHref, issuesHref, noTopic, sameName, whereShort, hearTxt, stepOn, clearedOf, clearedLabel, sitKeyOf, nextCtx, billHref } from './issues.js';

const enc = encodeURIComponent;
const n = (k, one, many) => `${k} ${k === 1 ? one : many}`;
const num = b => String(b.bill_number).replace(/\s/g, '');
// What is open on the page, kept across the minute's redraw in this visit only: the bills whose whole list of introducers was opened
export const bui = { all: new Set(), open: new Set(), edit: null, ctx: null, note: new Map(), noteSel: null, noteErr: false, noteBusy: false };   // all: bills whose whole list of introducers is open; open: the "Show all" lists of Part B (key: list|bill id)

// ---------------------------------------------------------------------------------- small parts
const ext = (url, label) => `<a class="lk" target="_blank" rel="noopener" href="${esc(url)}">${esc(label)}${ic('external-link')}</a>`;
const kv = rows => `<dl class="kv bfacts" id="bFacts">${rows.filter(Boolean).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join('')}</dl>`;
const boldFirst = t => { const k = String(t).indexOf(' · '); return k < 0 ? `<b>${esc(t)}</b>` : `<b>${esc(t.slice(0, k))}</b>${esc(t.slice(k))}`; };
const chamberWord = b => /^S/i.test(String(b.bill_number || '').trim()) ? 'Senate' : 'House';
const spaceVer = v => String(v || '').replace(/^(HD|SD|CD|FD)(\d+)$/, '$1 $2');
// the Capitol's own date a bill was stopped by (the m/d/yy at the end of died_deadline) as YYYY-MM-DD; '' when the data holds none
const stoppedISO = b => { const m = /(\d+)\/(\d+)\/(\d+)\s*$/.exec(b.died_deadline || ''); if (!m) return ''; const y = +m[3] < 100 ? 2000 + +m[3] : +m[3]; return `${y}-${String(m[1]).padStart(2, '0')}-${String(m[2]).padStart(2, '0')}`; };
const stoppedOn = b => { const d = stoppedISO(b); return d ? dateY(d) : ''; };
// The whole bill as it is now (copied from pub/billtext.js billTextUrl, which staff7 does not import): the Capitol keeps each draft as its own page, named for the newest draft
const billTextUrl = b => {
  const m = /^([A-Z]+)(\d+)$/.exec(String(b?.bill_number || '').toUpperCase().replace(/\s/g, '')); if (!m) return capitolUrl(b);
  const v = /^(HD|SD|CD|FD)\d{1,2}$/.test(b.current_version || '') ? `${b.current_version}_` : '';
  return `https://www.capitol.hawaii.gov/sessions/session${b.session_year || SESSION_YEAR}/bills/${m[1]}${m[2]}_${v}.HTM`;
};

// ---------------------------------------------------------------------------------- back
// "Back to <issue>", or where the person came from (the address carries from=calendar or from=search)
function backOf(issue, b, who, from) {
  let href, label;
  if (from === 'calendar') { href = `#/calendar${who.code ? `?who=${enc(who.code)}` : ''}`; label = 'Back to Calendar'; }
  else if (from === 'search') { href = '#/search'; label = 'Back to Search'; }
  else if (issue) { href = issueHref(who, issue.id); label = `Back to ${sameName(b, issue) ? 'the issue' : esc(eCig(issue.name))}`; }   // a bill the team tracks that is on no issue has no issue to go back to
  else { href = issuesHref(noTopic(who)); label = 'Back to Issues'; }
  return `<a class="crumb back2" id="bBack" href="${esc(href)}">${ic('chevron-left')}${label}</a>`;
}

// ---------------------------------------------------------------------------------- 1. the position and who leads
const person = id => S.advocates.find(a => a.id === id);
function leadHTML(b, issue, me) {
  const ids = leadIds(b, issue);
  if (!ids.length) return 'Nobody leads it yet';
  const names = ids.map(id => id === me?.id ? 'You' : (() => { const a = person(id); return a?.initials ? `<a class="lk" href="#/issues?who=${enc(a.initials)}">${esc(first(a))}</a>` : esc(first(a)); })());
  const j = names.length < 3 ? names.join(' and ') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  return `${j} ${names.length === 1 && ids[0] !== me?.id ? 'leads' : 'lead'}`;
}
function positionHTML(b, issue, me, can) {
  if (can && bui.edit && bui.edit.id === b.id) return editHTML(b, issue, me);   // the edit block stands in the position line's place
  const pos = b.position ? `<span class="bpos-k">HIPHI’s position</span> <b class="bpos">${esc(posWords(b))}</b>` : '<b class="bpos">No position yet</b>';
  return `<p class="bposl" id="bPos">${pos}<span class="bsep" aria-hidden="true">·</span><span id="bLead">${leadHTML(b, issue, me)}</span>${can ? editButton() : ''}</p>`;
}

// ---------------------------------------------------------------------------------- 2. where it stands
// Every coming hearing of the bill, one for each committee and time, soonest first
function aheadList(b) {
  const seen = new Set(), now = Date.now();
  return (S.hearings || []).filter(h => h.bill_id === b.id && h.status === 'scheduled' && new Date(h.scheduled_at).getTime() > now).sort((x, y) => String(x.scheduled_at).localeCompare(String(y.scheduled_at)))
    .filter(h => { const k = sitKeyOf(h); if (seen.has(k)) return false; seen.add(k); return true; });
}
const line = (html, { action = '', muted = false } = {}) => `<p class="bln${muted ? ' m' : ''}"><span class="blt">${html}</span>${action ? `<span class="bla">${action}</span>` : ''}</p>`;
// the page one hearing is on in Calendar, or '' when this person's calendar would not hold it (a bill on no issue that is not theirs)
function sitHref(h, who, own, onIssue) {
  const q = who.kind === 'person' || who.kind === 'all' ? `?who=${enc(who.code)}` : own ? '' : onIssue ? '?who=all' : null;
  return q == null ? '' : `#/calendar/sitting/${enc(sitKeyOf(h))}${q}`;
}
// why a stopped bill stopped, in a few plain words, without the date the line already says
function whyShort(b, plainDate) {
  let t = cleanCodes(whyWords(b), b).replace(/\.$/, '');
  if (t === 'Stopped') return '';
  if (plainDate) t = t.split(` on ${plainDate}`).join('').split(` by ${plainDate}`).join('').replace(', while', ' while');
  return t.replace(/^./, c => c.toLowerCase());
}
// two plain lines at most (a third only for another hearing), then the viewer's own step as the same tonal button the issue page has
function statusLines(b, issue, who, open, own, nx, onIssue) {
  const alive = isAlive(b), step = own ? stepOn(open, b) : null;
  const mine = step ? `<p class="bmv"><a class="btn quiet ymove" href="#/do/${enc(step.id)}">Your move · ${esc(step.verb)}</a></p>` : '';
  if (!alive) {
    const iso = stoppedISO(b), why = whyShort(b, iso ? dateWords(iso) : '');
    return line(`<b>Stopped${iso ? ` ${esc(dateY(iso))}` : ''}</b>${why ? ` · ${esc(why)}` : ''}`);
  }
  const hs = aheadList(b), h = hearingAhead(b) ? hs[0] : null, out = [], row = nx && nx.next ? nx.next.row : null;
  if (h) {
    const room = roomName(h.room), notice = http(h.notice_url) ? ` · ${ext(h.notice_url, 'Agenda')}` : '', sit = sitHref(h, who, own, onIssue);
    out.push(line(`<b>Hearing ${esc(hearTxt(h.scheduled_at))}</b> · ${cmtesLinks(h.committee, b)}${room ? ` · ${esc(room)}` : ''}${notice}`, { action: !step && sit ? btn('See the hearing', { kind: 'text', href: sit }) : '' }));
    const due = testimonyDue(h), st = letterState(h, b), gone = due <= Date.now(), t = hearTxt(due), accepted = new Date(h.scheduled_at).getTime() > Date.now();
    // the one amber on the page, in Calendar's own words and icon: testimony that was due, is not filed and is still accepted. Once it can no longer be filed it is a plain fact.
    const tl = !gone ? `<b>Testimony due ${esc(t)}</b> · ${esc(testimonyShort(st))}`
      : st.key === 'filed' ? `<b>Testimony was due ${esc(t)}</b> · filed`
      : accepted ? `<b class="riskt">${ic('triangle-alert')}${esc(lateLine(h.scheduled_at))}</b> · ${esc(testimonyShort(st))}`
      : `<b>Testimony was due ${esc(t)}</b> · not filed`;
    out.push(line(tl));
    const other = hs.find(x => sitKeyOf(x) !== sitKeyOf(h));
    if (other) { const sh = sitHref(other, who, own, onIssue), w = `Another hearing ${hearTxt(other.scheduled_at)}`; out.push(line(`${sh ? `<a class="lk" href="${sh}">${esc(w)}</a>` : esc(w)} · ${cmtesLinks(other.committee, b)}`, { muted: true })); }
    return out.join('') + mine;
  }
  const dl = deadlineOf(b), cleared = !!row && clearedOf(b, row) === 'yes';
  if (dl) {
    const cm = stopOf(b).committee, risk = isAtRisk(b), said = cleared ? `${clearedLabel(row)}.` : '';
    out.push(line(`<b>Needs a hearing by ${esc(whenWords(dl.date))}</b>${cm ? ` · in ${cmtesLinks(cm, b)}` : ''} · none is scheduled`));
    if (risk) out.push(line(`If it is not heard by then, it stops for the year.${said ? ` <span class="m">${esc(said)}</span>` : ''}`));
    else if (said) out.push(line(esc(said), { muted: true }));
    return out.join('') + mine;
  }
  const where = cleanCodes(whereWords(b, { deadline: false }), b);
  return (cleared ? line(`<b>${esc(clearedLabel(row))}</b> · ${esc(where)}`) : line(boldFirst(where))) + mine;
}
// A stopped bill's issue may have other bills still alive: where they are, each a link
function stillAlive(b, issue, who, others) {
  if (isAlive(b) || !issue) return '';
  return kv([['Still alive', others.length ? others.map(o => `<a class="lk" href="${billHref(who, o, issue.id)}">${esc(`${billNo(o)}, the ${chamberWord(o)} version · ${whereShort(o)}`)}</a>`).join('<br>') : 'No other bill on this issue is still moving.']]).replace('bfacts" id="bFacts"', 'bfacts" id="bAlive"');
}

// ---------------------------------------------------------------------------------- 4. the facts
// The committees in the order the bill goes through them: the ones it has passed, the one it is in, the one after. The referral list is read the way stops.js reads it: the first chamber's committees first, then the second's.
function cmteMarks(b) {
  const refs = (Array.isArray(b.referrals) ? b.referrals : []).map(String), marks = refs.map(() => ''), stage = effStage(b);
  if (!refs.length) return { refs, marks };
  const originN = Math.min(b.origin_stops || 0, refs.length) || (/^second_(triple|lateral|decking)$|^first_crossover$/.test(stage) ? 0 : refs.length);
  if (!isAlive(b)) {   // stopped: what it passed before the stop, when the stop's place on the path says so (after the first chamber's committees, all of those; at the Governor, all); else no marks, since the data does not say which committee held it
    const i = pathOf(b).i, firstN = originN || refs.length;
    for (let k = 0; k < (i >= 4 ? refs.length : i >= 2 ? firstN : 0); k++) marks[k] = 'done';
    return { refs, marks };
  }
  const st = stopOf(b), second = st.leg === 'second', lo = second ? originN : 0, hi = second ? refs.length : (originN || refs.length);
  if (st.phase === 'committee' && st.committee) {
    const cur = codesOf(st.committee), at = []; for (let i = lo; i < hi; i++) if (codesOf(refs[i]).some(c => cur.includes(c))) at.push(i);
    if (at.length) {
      for (let i = 0; i < at[0]; i++) marks[i] = 'done';
      for (const i of at) marks[i] = 'now';
      if (at[at.length - 1] + 1 < hi) marks[at[at.length - 1] + 1] = 'next';
    } else if (second) for (let i = 0; i < originN; i++) marks[i] = 'done';
  } else if (stage === 'first_crossover' && !st.committee) for (let i = 0; i < (originN || refs.length); i++) marks[i] = 'done';   // crossed, not yet in a committee of the other chamber: the first chamber's are all behind it
  else if (['floor', 'conference', 'governor', 'law', 'ballot'].includes(st.phase)) for (let i = 0; i < (st.phase === 'floor' && !second ? (originN || refs.length) : refs.length); i++) marks[i] = 'done';
  return { refs, marks };
}
// The referral, one row for each chamber (Nate 15 Nov: the referral matters for the chamber the bill is in and the one before it): the chamber it is in now first, then the one it came from.
// Returns [[label, html], ...] for the facts list. A bill that has crossed and has no committees in the other chamber yet says so.
function referralRows(b) {
  const { refs, marks } = cmteMarks(b); if (!refs.length) return [];
  const stage = effStage(b), originN = Math.min(b.origin_stops || 0, refs.length) || (/^second_(triple|lateral|decking)$|^first_crossover$/.test(stage) ? 0 : refs.length);
  const item = (ref, m) => {
    const ls = codesOf(ref).map(c => cmteLink(c, b, m === 'done' ? ' dim' : '')).join(' with ');
    return m === 'done' ? `<span class="bcd">${ls}<span aria-hidden="true"> ✓</span><span class="vh"> (passed)</span></span>` : m === 'now' ? `<b>${ls}&nbsp;(now)</b>` : m === 'next' ? `<span>${ls}&nbsp;(next)</span>` : `<span>${ls}</span>`;
  };
  const row = (leg, lo, hi) => `<span class="bcms" data-leg="${leg}">${refs.slice(lo, hi).map((r, i) => item(r, marks[lo + i])).join(' · ')}</span>`;
  const one = /^[HS]R\d/.test(num(b)), origin = /^S/i.test(num(b)) ? 'Senate' : 'House', other = origin === 'Senate' ? 'House' : 'Senate';
  if (one) return [['Referral', row(1, 0, refs.length)]];
  const inSecond = isAlive(b) ? (stopOf(b).leg === 'second' || stage === 'first_crossover') : pathOf(b).i >= 2;
  const first = originN ? [`${origin} referral`, row(1, 0, originN)] : null;
  const second = originN < refs.length ? [`${other} referral`, row(2, originN, refs.length)] : inSecond ? [`${other} referral`, '<span class="m">Not referred yet</span>'] : null;
  return (inSecond ? [second, first] : [first, second]).filter(Boolean);
}
// A companion: its number, and where it stands when we can find it (one of our bills, or in the practice index)
function companionsHTML(b, who) {
  const nums = [...new Set(companionsOf(b))]; if (!nums.length) return '';
  const idx = S.snapshot?.index || [];
  const li = c => {
    const t = c.replace(/^([A-Z]+)(\d)/, '$1 $2'), own = (S.bills || []).find(x => num(x) === c && (!x.session_year || !b.session_year || +x.session_year === +b.session_year));
    if (own && own.tracked !== false) return `<li><a class="lk" href="${billHref(who, own, '')}">${esc(t)}</a> · ${esc(isAlive(own) ? whereShort(own) : `stopped${stoppedOn(own) ? ` ${stoppedOn(own)}` : ''}`)}</li>`;
    if (own) return `<li>${esc(t)} · ${esc(isAlive(own) ? whereShort(own) : `stopped${stoppedOn(own) ? ` ${stoppedOn(own)}` : ''}`)}</li>`;
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
function sponsorsHTML(b) {
  const sps = (b.sponsors || []).filter(s => String(s?.n || s?.name || s || '').trim()); if (!sps.length) return '';
  const all = sps.map(s => legFor(s, b)), rest = all.length - 1, open = bui.all.has(b.id);
  if (!rest) return all[0];
  return `<span data-bs="short"${open ? ' hidden' : ''}>${all[0]} and ${n(rest, 'other', 'others')}</span><span data-bs="long"${open ? '' : ' hidden'}>${all.join(', ')}</span> · ${btn(open ? 'Show fewer' : 'Show all', { kind: 'text', attrs: `data-bshow="${esc(b.id)}" aria-expanded="${open}" aria-label="${open ? 'Show fewer' : 'Show all'} introducers"` })}`;
}
function factsHTML(b, who) {
  const desc = (String(b.public_summary || '').trim() || String(b.description || '').replace(/\s+/g, ' ').trim()), ver = spaceVer(b.current_version), cap = capitolUrl(b);
  const does = [ver ? `<span class="m">Version ${esc(ver)}</span>` : '', http(billTextUrl(b)) ? ext(billTextUrl(b), 'Read the bill') : '', http(cap) ? ext(cap, 'The Capitol’s page') : ''].filter(Boolean).join(' · ');
  const issues = (S.billIssues || []).filter(x => x.bill_id === b.id).map(x => (S.issues || []).find(i => i.id === x.issue_id)).filter(i => i && !i.archived_at);
  const sps = sponsorsHTML(b), comp = companionsHTML(b, who);
  return kv([
    ...referralRows(b),
    ['What it does', `${desc ? `${esc(eCig(desc))} ` : ''}${does}`],
    ['Issue', issues.length ? issues.map(i => `<a class="lk" href="${issueHref(who, i.id)}">${esc(eCig(i.name))}</a>`).join(' · ') : 'On no issue yet'],
    comp ? ['Companion bills', comp] : null, sps ? ['Introduced by', sps] : null]);
}

// ---------------------------------------------------------------------------------- the page
// `x`: { nx: the session as the Issues list has it (its next deadline), from: 'calendar' | 'search' | '' }
export function billSheet(b, issue, who, me, open, others, own, x = {}) {
  const alive = isAlive(b), nx = x.nx || nextCtx(), from = x.from === 'calendar' || x.from === 'search' ? x.from : '';
  const onIssue = (S.billIssues || []).some(y => y.bill_id === b.id && (S.issues || []).some(i => i.id === y.issue_id && !i.archived_at));
  let out = `<div class="pn"><div class="hband" style="${alive ? tint(issue) : '--ic:var(--edge)'}"><span class="imark big" aria-hidden="true">${ic(iconOf(issue))}</span><div class="ht">${backOf(issue, b, who, from)}<h1 tabindex="-1">${esc(billName(b))}</h1><p class="bsub">${esc(billNo(b))}</p></div></div><div class="pbody bill">`;
  const can = mayEdit(b, issue, me); if (!(can && bui.edit && bui.edit.id === b.id)) bui.edit = null;   // an edit open on another bill, or one this person may not make, is dropped
  bui.ctx = { b, issue, me };
  out += positionHTML(b, issue, me, can);
  out += `<div class="bstat" id="bStat">${statusLines(b, issue, who, open, own, nx, onIssue)}</div>`;
  out += stillAlive(b, issue, who, others);
  out += `<div class="bigpath">${billPath(b, { wide: true })}</div>`;
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
  bindEdit(); bindPartB();
}
