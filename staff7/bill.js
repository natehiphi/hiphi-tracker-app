// Staff7's bill page (R-398). Part A: the band, HIPHI's position and who leads, where the bill stands (two plain lines), the path drawing and the bill's facts (what it does, issue, committees, companions,
// sponsors). Everything here is worked out from data already in memory, and the words for dates and states come from the SAME helpers the Issues list uses (hearTxt, whenWords, deadlineOf, isAtRisk, clearedOf,
// whereWords, testimonyDue, bill_words.js), so the list and this page never disagree. Looking never changes anything: only a bill on one of the viewer's own issues has a link to one of their steps.
// Part B (Team notes, Past hearings, History) is bill_history.js, drawn after the facts; Part C (Change position or lead, Add a note) is bill_edit.js.
import { S, SESSION_YEAR, capitolUrl, effStage } from '../staff6/data.js';
import { hearingAhead, stopOf, roomName, companionsOf } from '../staff6/model.js';
import { whereWords } from '../staff6/steps.js';
import { ic } from './icons7.js';
import { esc, btn } from './parts.js';
import { billName, billNo, posWords, cmteWords, first } from './steps.js';
import { isAlive, deadlineOf, isAtRisk } from './standing.js';
import { dateWords, whyWords } from './words.js';
import { billPath, pathOf } from './path.js';
import { norm } from './find.js';
import { testimonyDue, letterState, testimonyShort, leadIds } from './bill_words.js';
import { partB, bindPartB } from './bill_history.js';
import { editButton, editHTML, mayEdit, bindEdit } from './bill_edit.js';
import { eCig, iconOf, tint, issueHref, issuesHref, noTopic, lookLine, sameName, clean, whereShort, hearTxt, stepOn, clearedOf, sitKeyOf, nextCtx, billHref } from './issues.js';

const enc = encodeURIComponent;
const n = (k, one, many) => `${k} ${k === 1 ? one : many}`;
const http = u => /^https?:\/\//i.test(String(u || '').trim());
const num = b => String(b.bill_number).replace(/\s/g, '');
// What is open on the page, kept across the minute's redraw in this visit only: the bills whose whole list of introducers was opened
export const bui = { all: new Set(), open: new Set(), edit: null, ctx: null, note: new Map(), noteSel: null, noteErr: false, noteBusy: false };   // all: bills whose whole list of introducers is open; open: the "Show all" lists of Part B (key: list|bill id)

// ---------------------------------------------------------------------------------- small parts
const ext = (url, label) => `<a class="lk" target="_blank" rel="noopener" href="${esc(url)}">${esc(label)}${ic('external-link')}</a>`;
const kv = rows => `<dl class="kv bfacts" id="bFacts">${rows.filter(Boolean).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join('')}</dl>`;
const cmteLink = code => S.committees?.[code] ? `<a class="lk" href="#/search/committee/${enc(code)}">${esc(cmteWords(code))}</a>` : esc(cmteWords(code));
// a committee or a joint pair: "House Health with House Human Services", each one a link
const cmtesLinks = codes => String(codes || '').split('/').map(c => c.trim()).filter(Boolean).map(cmteLink).join(' with ');
const boldFirst = t => { const k = String(t).indexOf(' · '); return k < 0 ? `<b>${esc(t)}</b>` : `<b>${esc(t.slice(0, k))}</b>${esc(t.slice(k))}`; };
const chamberWord = b => /^S/i.test(String(b.bill_number || '').trim()) ? 'Senate' : 'House';
const spaceVer = v => String(v || '').replace(/^(HD|SD|CD|FD)(\d+)$/, '$1 $2');
const daysLeft = d => d <= 0 ? 'the last day is today' : d === 1 ? '1 day left' : `${d} days left`;
// the Capitol's own date a bill was stopped by (the m/d/yy at the end of died_deadline), in the app's one date form; '' when the data holds none
const stoppedOn = b => { const m = /(\d+)\/(\d+)\/(\d+)\s*$/.exec(b.died_deadline || ''); if (!m) return ''; const y = +m[3] < 100 ? 2000 + +m[3] : +m[3]; return dateWords(`${y}-${String(m[1]).padStart(2, '0')}-${String(m[2]).padStart(2, '0')}`); };
// The whole bill as it is now (copied from pub/billtext.js billTextUrl, which staff7 does not import): the Capitol keeps each draft as its own page, named for the newest draft
const billTextUrl = b => {
  const m = /^([A-Z]+)(\d+)$/.exec(String(b?.bill_number || '').toUpperCase().replace(/\s/g, '')); if (!m) return capitolUrl(b);
  const v = /^(HD|SD|CD|FD)\d{1,2}$/.test(b.current_version || '') ? `${b.current_version}_` : '';
  return `https://www.capitol.hawaii.gov/sessions/session${b.session_year || SESSION_YEAR}/bills/${m[1]}${m[2]}_${v}.HTM`;
};

// ---------------------------------------------------------------------------------- the seams for the parts that come next

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
function statusLines(b, issue, who, open, own, nx, onIssue) {
  const alive = isAlive(b), step = own ? stepOn(open, b) : null, act = step ? btn(step.verb, { kind: 'text', href: `#/do/${enc(step.id)}` }) : '';
  if (!alive) {
    const p = pathOf(b), when = stoppedOn(b);
    return [line(`<b>Stopped${when ? ` ${esc(when)}` : ''}</b>${p.i >= 1 ? ` · at ${esc(p.label)}` : ''}`), line(esc(clean(whyWords(b))), { muted: true })];
  }
  const hs = aheadList(b), h = hearingAhead(b) ? hs[0] : null, out = [], row = nx && nx.next ? nx.next.row : null;
  if (h) {
    const room = roomName(h.room), notice = http(h.notice_url) ? ` · ${ext(h.notice_url, 'Agenda')}` : '';
    out.push(line(`<b>Hearing ${esc(hearTxt(h.scheduled_at))}</b> · ${cmtesLinks(h.committee)}${room ? ` · ${esc(room)}` : ''}${notice}`));
    const due = testimonyDue(h), st = letterState(h, b), late = due <= Date.now() && st.key !== 'filed', t = hearTxt(due);
    const sit = sitHref(h, who, own, onIssue), go = act || (sit ? btn('See the hearing', { kind: 'text', href: sit }) : '');
    // the one amber on the page: testimony that was due and is not filed (the hearing is still ahead, so it is still accepted)
    out.push(line(`${late ? `<b class="riskt">${ic('triangle-alert')}Testimony was due ${esc(t)}</b>` : `<b>Testimony ${due <= Date.now() ? 'was due' : 'due'} ${esc(t)}</b>`} · ${esc(testimonyShort(st))}`, { action: go }));
    const other = hs.find(x => sitKeyOf(x) !== sitKeyOf(h));
    if (other) { const sh = sitHref(other, who, own, onIssue), w = `Another hearing ${hearTxt(other.scheduled_at)}`; out.push(line(`${sh ? `<a class="lk" href="${sh}">${esc(w)}</a>` : esc(w)} · ${cmtesLinks(other.committee)}`, { muted: true })); }
    return out;
  }
  const dl = deadlineOf(b), cleared = !!row && clearedOf(b, row) === 'yes';
  if (dl) {
    const cm = stopOf(b).committee, risk = isAtRisk(b), said = cleared ? `Cleared the ${dateWords(row.date)} deadline.` : '';
    out.push(line(`<b>Needs a hearing by ${esc(dateWords(dl.date))}</b>${cm ? ` · in ${cmtesLinks(cm)}` : ''} · ${esc(daysLeft(dl.days))} · none is scheduled`, { action: risk || said ? '' : act }));
    if (risk) out.push(line(`If it is not heard by then, it stops for the year.${said ? ` <span class="m">${esc(said)}</span>` : ''}`, { action: act }));
    else if (said) out.push(line(esc(said), { muted: true, action: act }));
    return out;
  }
  const where = whereWords(b, { deadline: false });
  if (cleared) return [line(`<b>Cleared the ${esc(dateWords(row.date))} deadline</b> · ${esc(where)}`, { action: act })];
  return [line(boldFirst(where), { action: act })];
}
// A stopped bill's issue may have other bills still alive: where they are, each a link
function stillAlive(b, issue, who, others) {
  if (isAlive(b) || !issue) return '';
  return kv([['Still alive', others.length ? others.map(o => `<a class="lk" href="${billHref(who, o, issue.id)}">${esc(`${billNo(o)}, the ${chamberWord(o)} version · ${whereShort(o)}`)}</a>`).join('<br>') : 'Nothing else is alive for this issue this year.']]).replace('bfacts" id="bFacts"', 'bfacts" id="bAlive"');
}

// ---------------------------------------------------------------------------------- 4. the facts
// The committees in the order the bill goes through them: the ones it has passed, the one it is in, the one after. The referral list is read the way stops.js reads it: the first chamber's committees first, then the second's.
const codesOf = c => String(c || '').split('/').map(x => x.trim()).filter(Boolean);
function cmteMarks(b) {
  const refs = (Array.isArray(b.referrals) ? b.referrals : []).map(String), marks = refs.map(() => ''), stage = effStage(b);
  if (!refs.length || !isAlive(b)) return { refs, marks };
  const st = stopOf(b), originN = Math.min(b.origin_stops || 0, refs.length) || (/^second_(triple|lateral|decking)$|^first_crossover$/.test(stage) ? 0 : refs.length), second = st.leg === 'second';
  const lo = second ? originN : 0, hi = second ? refs.length : (originN || refs.length);
  if (st.phase === 'committee' && st.committee) {
    const cur = codesOf(st.committee), at = []; for (let i = lo; i < hi; i++) if (codesOf(refs[i]).some(c => cur.includes(c))) at.push(i);
    if (at.length) {
      for (let i = 0; i < at[0]; i++) marks[i] = 'done';
      for (const i of at) marks[i] = 'now';
      if (at[at.length - 1] + 1 < hi) marks[at[at.length - 1] + 1] = 'next';
    } else if (second) for (let i = 0; i < originN; i++) marks[i] = 'done';
  } else if (['floor', 'conference', 'governor', 'law', 'ballot', 'vetoed'].includes(st.phase)) for (let i = 0; i < (st.phase === 'floor' && !second ? (originN || refs.length) : refs.length); i++) marks[i] = 'done';
  return { refs, marks };
}
function committeesHTML(b) {
  const { refs, marks } = cmteMarks(b); if (!refs.length) return '';
  const item = (ref, m) => {
    const ls = codesOf(ref).map(c => S.committees?.[c] ? `<a class="lk${m === 'done' ? ' dim' : ''}" href="#/search/committee/${enc(c)}">${esc(cmteWords(c))}</a>` : esc(cmteWords(c))).join(' with ');
    return m === 'done' ? `<span class="bcd">${ls}<span aria-hidden="true"> ✓</span><span class="vh"> (passed)</span></span>` : m === 'now' ? `<b>${ls}&nbsp;(now)</b>` : m === 'next' ? `<span>${ls}&nbsp;(next)</span>` : `<span>${ls}</span>`;
  };
  return `<span class="bcms">${refs.map((r, i) => item(r, marks[i])).join(' · ')}</span>`;
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
  return `<span data-bs="short"${open ? ' hidden' : ''}>${all[0]} and ${n(rest, 'other', 'others')}</span><span data-bs="long"${open ? '' : ' hidden'}>${all.join(', ')}</span> · ${btn(open ? 'Show fewer' : 'Show all', { kind: 'text', attrs: `data-bshow="${esc(b.id)}" aria-expanded="${open}"` })}`;
}
function factsHTML(b, who) {
  const desc = (String(b.public_summary || '').trim() || String(b.description || '').replace(/\s+/g, ' ').trim()), ver = spaceVer(b.current_version), cap = capitolUrl(b);
  const does = [ver ? `<span class="m">Version ${esc(ver)}</span>` : '', ext(billTextUrl(b), 'Read the bill'), http(cap) ? ext(cap, 'The Capitol’s page') : ''].filter(Boolean).join(' · ');
  const issues = (S.billIssues || []).filter(x => x.bill_id === b.id).map(x => (S.issues || []).find(i => i.id === x.issue_id)).filter(i => i && !i.archived_at);
  const sps = sponsorsHTML(b), cms = committeesHTML(b), comp = companionsHTML(b, who);
  return kv([
    ['What it does', `${desc ? `${esc(eCig(desc))} ` : ''}${does}`],
    ['Issue', issues.length ? issues.map(i => `<a class="lk" href="${issueHref(who, i.id)}">${esc(eCig(i.name))}</a>`).join(' · ') : 'On no issue yet'],
    cms ? ['Committees', cms] : null, comp ? ['Companion bills', comp] : null, sps ? ['Introduced by', sps] : null]);
}

// ---------------------------------------------------------------------------------- the page
// Same call as before, with `x`: { nx: the session as the Issues list has it (its next deadline), from: 'calendar' | 'search' | '' }
export function billSheet(b, issue, who, me, open, others, own, x = {}) {
  const alive = isAlive(b), lo = !own, nx = x.nx || nextCtx(), from = x.from === 'calendar' || x.from === 'search' ? x.from : '';
  const onIssue = (S.billIssues || []).some(y => y.bill_id === b.id && (S.issues || []).some(i => i.id === y.issue_id && !i.archived_at));
  let out = `<div class="pn"><div class="hband" style="${alive ? tint(issue) : '--ic:var(--edge)'}"><span class="imark big" aria-hidden="true">${ic(iconOf(issue))}</span><div class="ht">${backOf(issue, b, who, from)}<h1 tabindex="-1">${esc(billName(b))}</h1><p class="bsub">${esc(billNo(b))}</p></div></div><div class="pbody bill">`;
  const can = mayEdit(b, issue, me, own); if (!(can && bui.edit && bui.edit.id === b.id)) bui.edit = null;   // an edit open on another bill, or one this person may not make, is dropped
  bui.ctx = { b, issue, me };
  out += positionHTML(b, issue, me, can);
  if (lo) out += `<p class="hint blook">${esc(lookLine(who))}</p>`;
  out += `<div class="bstat" id="bStat">${statusLines(b, issue, who, open, own, nx, onIssue).join('')}</div>`;
  out += stillAlive(b, issue, who, others);
  out += `<div class="bigpath">${billPath(b, { wide: true })}</div>`;
  out += factsHTML(b, who);
  out += partB(b, issue, who, me);
  return out + `</div></div>`;
}

// "Show all" on the introducers: opens the whole list in place; the state is kept for the minute's redraw
export function bindBill() {
  document.querySelectorAll('button[data-bshow]').forEach(bt => bt.addEventListener('click', () => {
    const on = bt.getAttribute('aria-expanded') !== 'true', id = bt.dataset.bshow, dd = bt.closest('dd');
    if (on) bui.all.add(id); else bui.all.delete(id);
    bt.setAttribute('aria-expanded', String(on)); bt.textContent = on ? 'Show fewer' : 'Show all';
    dd?.querySelector('[data-bs="short"]')?.toggleAttribute('hidden', on); dd?.querySelector('[data-bs="long"]')?.toggleAttribute('hidden', !on);
  }));
  bindEdit(); bindPartB();
}
