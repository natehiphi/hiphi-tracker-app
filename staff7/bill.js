// Staff7's bill page (R-398). Part A: the band, HIPHI's position and who leads, where the bill stands (two plain lines), the path drawing and the bill's facts (what it does, issue, committees, companions,
// sponsors). Everything here is worked out from data already in memory, and the words for dates and states come from the SAME helpers the Issues list uses (hearTxt, whenWords, deadlineOf, isAtRisk, clearedOf,
// whereWords, testimonyDue, bill_words.js), so the list and this page never disagree. Looking never changes anything: only a bill on one of the viewer's own issues has a link to one of their steps.
// Part B (Team notes, Past hearings, History) is bill_history.js, drawn after the facts; Part C (Change position or lead, Add a note) is bill_edit.js.
import { S, capitolUrl } from '../staff6/data.js';
import { hearingAhead, stopOf, roomName, companionsOf } from '../staff6/model.js';
import { whereWords, whoseStep } from '../staff6/steps.js';
import { ic } from './icons7.js';
import { esc, btn } from './parts.js';
import { billName, billNo, posWords, first, lateLine } from './steps.js';
import { isAlive, deadlineOf, isAtRisk } from './standing.js';
import { dateWords, whenWords, whyWords } from './words.js';
import { norm } from './find.js';
import { testimonyDue, letterState, testimonyShort, leadIds, http, dateY, draftFor, cmtesLinks, cleanCodes, ext } from './bill_words.js';
import { billTimeline } from './bill_tl.js';
import { billTextUrl, afterHTML, moreAfterHTML, chairsHTML, askedWords, publicHTML, talkingHTML, bindMore } from './bill_more.js';
import { partB, bindPartB } from './bill_history.js';
import { editButton, editHTML, mayEdit, bindEdit } from './bill_edit.js';
import { eCig, iconOf, tint, issueHref, issuesHref, noTopic, sameName, whereShort, hearTxt, stepOn, clearedOf, clearedLabel, sitKeyOf, nextCtx, billHref } from './issues.js';

const enc = encodeURIComponent;
const n = (k, one, many) => `${k} ${k === 1 ? one : many}`;
const num = b => String(b.bill_number).replace(/\s/g, '');
// What is open on the page, kept across the minute's redraw in this visit only: the bills whose whole list of introducers was opened
export const bui = { all: new Set(), open: new Set(), edit: null, ctx: null, note: new Map(), noteSel: null, noteErr: false, noteBusy: false, noteOpen: null, talk: new Set(), cap: new Set() };   // talk: bills whose talking points are open; cap: bills whose "More from the Capitol’s page" is open; noteOpen: the bill whose note box is open   // all: bills whose whole list of introducers is open; open: the "Show all" lists of Part B (key: list|bill id)

// ---------------------------------------------------------------------------------- small parts
const kv = rows => `<dl class="kv bfacts" id="bFacts">${rows.filter(Boolean).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join('')}</dl>`;
const boldFirst = t => { const k = String(t).indexOf(' · '); return k < 0 ? `<b>${esc(t)}</b>` : `<b>${esc(t.slice(0, k))}</b>${esc(t.slice(k))}`; };
const chamberWord = b => /^S/i.test(String(b.bill_number || '').trim()) ? 'Senate' : 'House';
// the Capitol's own date a bill was stopped by (the m/d/yy at the end of died_deadline) as YYYY-MM-DD; '' when the data holds none
const stoppedISO = b => { const m = /(\d+)\/(\d+)\/(\d+)\s*$/.exec(b.died_deadline || ''); if (!m) return ''; const y = +m[3] < 100 ? 2000 + +m[3] : +m[3]; return `${y}-${String(m[1]).padStart(2, '0')}-${String(m[2]).padStart(2, '0')}`; };
const stoppedOn = b => { const d = stoppedISO(b); return d ? dateY(d) : ''; };
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
const line = (html, { muted = false, id = '' } = {}) => `<p class="bln${muted ? ' m' : ''}"${id ? ` id="${id}"` : ''}><span class="blt">${html}</span></p>`;
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
// The viewer's own step as the same tonal button the issue page has, under the lines
const mineBtn = step => step ? `<p class="bmv"><a class="btn quiet ymove" href="#/do/${enc(step.id)}">Your move · ${esc(step.verb)}</a></p>` : '';
// "waiting for Nate’s approval" / "waiting for a second look by Kris", when the data names the one person who can give it (whoseStep); else the plain state ("waiting for approval")
function testimonyState(h, b, st) {
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
    const iso = stoppedISO(b), why = whyShort(b, iso ? dateWords(iso) : '');
    const al = !issue ? '' : others.length ? others.map((o, k) => line(`${k ? '' : 'Still alive for this issue: '}<a class="lk" href="${billHref(who, o, issue.id)}">${esc(`${billNo(o)}, the ${chamberWord(o)} version`)}</a> · ${esc(whereShort(o))}`, { id: k ? '' : 'bAlive' })).join('')
      : line('No other bill on this issue is still moving.', { id: 'bAlive' });
    return line(`<b>Stopped${iso ? ` ${esc(dateY(iso))}` : ''}</b>${why ? ` · ${esc(why)}` : ''}`) + al;
  }
  const hs = aheadList(b), h = hearingAhead(b) ? hs[0] : null, out = [], row = nx && nx.next ? nx.next.row : null;
  if (h) {
    const room = roomName(h.room), notice = http(h.notice_url) ? ` · ${ext(h.notice_url, 'Agenda')}` : '', sit = sitHref(h, who, own, onIssue);
    // "See the hearing" ends the hearing line (a link to the sitting in Calendar), unless the viewer has a step of their own to do
    out.push(line(`<b>Hearing ${esc(hearTxt(h.scheduled_at))}</b> · ${cmtesLinks(h.committee, b)}${room ? ` · ${esc(room)}` : ''}${notice}${!step && sit ? ` · <a class="lk" href="${sit}">See the hearing</a>` : ''}`));
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
    out.push(line(`<b>Needs a hearing by ${esc(whenWords(dl.date))}</b>${cm ? ` · in ${cmtesLinks(cm, b)}` : ''} · none is scheduled`));
    const l2 = [risk ? esc('If it is not heard by then, it stops for the year.') : '', chair].filter(Boolean).join(' ');
    if (l2 || (risk && said)) out.push(line(`${l2}${risk && said ? ` <span class="m">${esc(said)}</span>` : ''}`));
    if (!risk && said) out.push(line(esc(said), { muted: true }));
    const asked = cm ? askedWords(b, cm) : '', more = moreAfterHTML(b), l3 = [asked ? `${esc(asked)}.` : '', more].filter(Boolean).join(' ');
    if (l3) out.push(line(l3, { muted: true }));
    return out.join('') + mine;
  }
  const where = cleanCodes(whereWords(b, { deadline: false }), b);
  // in a committee with nothing scheduled and no deadline of its own to chase: say so, and the date the committee must hear it by when the Capitol's calendar gives one (never guessed)
  const cs = stopOf(b), cd = cs.deadline && !cs.deadline.missed ? cs.deadline : null;
  const none = cs.phase === 'committee' && cs.committee ? line(`No hearing is scheduled in ${cmtesLinks(cs.committee, b)} yet${cd ? `, which must hear it by ${esc(whenWords(cd.date))}` : ''}`, { muted: true }) : '';
  return (cleared ? line(`<b>${esc(clearedLabel(row))}</b> · ${esc(where)}`) : line(boldFirst(where))) + none + mine;
}

// ---------------------------------------------------------------------------------- 4. the facts
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
  const desc = (String(b.public_summary || '').trim() || String(b.description || '').replace(/\s+/g, ' ').trim()), sps = sponsorsHTML(b), comp = companionsHTML(b, who), talk = talkingHTML(b);
  return kv([
    desc ? ['What it does', esc(eCig(desc))] : null,
    comp ? ['Companion bills', comp] : null, sps ? ['Introduced by', sps] : null,
    ['On the public site', publicHTML(b)],
    talk ? ['Talking points', talk] : null]);
}
// the number's line in the band: "HB 1523 · The Capitol’s page ↗ · Read the bill ↗" (the two links wrap to their own line on a phone)
function numberLine(b) {
  const cap = capitolUrl(b), txt = billTextUrl(b), ls = [http(cap) ? ext(cap, 'The Capitol’s page') : '', http(txt) ? ext(txt, 'Read the bill') : ''].filter(Boolean);
  return `<p class="bsub"><span class="bno">${esc(billNo(b))}</span>${ls.length ? `<span class="bls">${ls.map(l => `<span class="bsep" aria-hidden="true">·</span>${l}`).join('')}</span>` : ''}</p>`;
}

// ---------------------------------------------------------------------------------- the page
// `x`: { nx: the session as the Issues list has it (its next deadline), from: 'calendar' | 'search' | '' }
export function billSheet(b, issue, who, me, open, others, own, x = {}) {
  const alive = isAlive(b), nx = x.nx || nextCtx(), from = x.from === 'calendar' || x.from === 'search' ? x.from : '';
  const onIssue = (S.billIssues || []).some(y => y.bill_id === b.id && (S.issues || []).some(i => i.id === y.issue_id && !i.archived_at));
  let out = `<div class="pn"><div class="hband bb" style="${alive ? tint(issue) : '--ic:var(--edge)'}"><span class="imark big" aria-hidden="true">${ic(iconOf(issue))}</span><div class="ht">${backOf(issue, b, who, from)}<h1 tabindex="-1">${esc(billName(b))}</h1>${numberLine(b)}</div></div><div class="pbody bill">`;
  const can = mayEdit(b, issue, me); if (!(can && bui.edit && bui.edit.id === b.id)) bui.edit = null;   // an edit open on another bill, or one this person may not make, is dropped
  bui.ctx = { b, issue, me };
  out += positionHTML(b, issue, me, can);
  if (!onIssue) out += '<p class="hint bnoiss" id="bNoIssue">On no issue yet</p>';
  out += `<div class="bstat" id="bStat">${statusLines(b, issue, who, open, own, nx, onIssue, others)}</div>`;
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
  bindEdit(); bindPartB(); bindMore();
}
