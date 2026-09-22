// HIPHI Staff v2 · Bill > Testimony (R-027). A person comes here to see what HIPHI has already written on this bill
// and its issue, so the next testimony starts from the last one (B-1).
// Every testimony draft the tracker has made (sync/testimony.js: one Google Doc per bill and committee) that somebody
// has worked on, newest first, in four parts: this bill and its companion; the other bills in its issue (R-018); a
// search; the rest of its category, folded, the issues nearest this one first. "Newest filed" marks the Doc to open
// first.
// Not repeated here (A-14): this bill's unfinished drafts, which the Next up card carries. Left out: a Doc nobody has
// sent for review yet, which is still the template with the header filled in, and one whose hearing was cancelled
// before anyone wrote in it (the database cancels only drafts still in "draft").
// Scope (Nate, 9/21): drafts made through the app. HIPHI's filed testimony from the Capitol's record comes later
// (docs/TESTIMONY-LIBRARY-PLAN.md, REQUESTS "Parked"), so the search says what it covers.
// A fresh-eyes review (9/21) shaped the rows: no "Filed" chip on filed rows (only the exceptions get one), the date in
// its own column, a plain label rather than an arrow that looked like a link, and one card for the folded category.
import { S, DB, DEMO, esc, fmtDate, advocate, capitolUrl } from './data.js';
import { codesOf } from './model.js';
import { icon, btn, chip, empty } from './ui.js';
import { cmteFull, billName, firstName } from './bill.js';
import { issuesOfBill, catByKey } from './issues.js';

// ---- which drafts count ----
// Sent for review at least once: in review, approved, filed, or sent back to draft with changes asked for.
const worked = d => ['review', 'second_review', 'approved', 'filed'].includes(d.status) || (d.status === 'draft' && !!d.submitted_at);
const allWorked = () => Object.values(S.drafts || {}).flat().filter(worked);
const billById = id => S.bills.find(x => String(x.id) === String(id)) || S.draftBills?.[id] || null;
// A companion is a bill number in the same session; prefer that session's bill when a number repeats across years.
const compsOf = b => (b.companions || []).map(n => S.bills.find(x => x.bill_number === n && x.session_year === b.session_year)
  || S.bills.find(x => x.bill_number === n)).filter(x => x && x.id !== b.id);
const billsOfIssue = id => (S.billIssues || []).filter(x => x.issue_id === id).map(x => billById(x.bill_id)).filter(Boolean);

// ---- when: the hearing it was written for, else when it was filed, sent or made ----
// Staff v2 loads 60 days of hearings; DB.loadDraftHearings fills in the older ones a draft points to.
const hearingOf = d => d.hearing_id ? (S.hearings || []).find(h => h.id === d.hearing_id) || S.draftHearings?.[d.hearing_id] || null : null;
const whenOf = d => hearingOf(d)?.scheduled_at || d.filed_at || d.submitted_at || d.created_at || '';
const newest = (x, y) => String(whenOf(y)).localeCompare(String(whenOf(x)));
const ahead = d => { const h = hearingOf(d); return !!h && new Date(h.scheduled_at).getTime() > Date.now(); };
// "Tue 2/10/26": the year rides along because this list reaches back across sessions.
const dayYear = iso => iso ? fmtDate(iso, { weekday: 'short', year: '2-digit' }).replace(/^(\w{3}),/, '$1') : '';

// ---- the folded category, nearest first ----
// Issues that share words with this bill's issue and nickname come first ("school meals" before SNAP on a free
// school meals bill), then the ones with the most testimony.
const STOP = new Set(['the', 'and', 'for', 'more', 'less', 'all', 'every', 'over', 'with', 'from', 'into', 'new', 'end', 'off', 'out', 'any']);
const wordsOf = s => new Set(String(s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/)
  .filter(w => w.length > 2 && !STOP.has(w)).map(w => w.replace(/(ies|es|s)$/, m => m === 'ies' ? 'y' : '')));
const shared = (a, b) => { let n = 0; for (const w of a) if (b.has(w)) n++; return n; };

// ---- the four parts, worked out once per render ----
function model(b) {
  const all = allWorked(), comps = compsOf(b), compIds = new Set(comps.map(x => String(x.id)));
  // This bill's own: filed, for a hearing that has passed (the rest is on Next up). A companion's: everything worked on,
  // because a colleague's draft on the twin bill is exactly what to read first.
  const own = all.filter(d => (String(d.bill_id) === String(b.id) && d.status === 'filed' && !ahead(d)) || compIds.has(String(d.bill_id))).sort(newest);
  const issues = issuesOfBill(b.id), issueIds = new Set(issues.map(i => i.id));
  const sameIds = new Set(issues.flatMap(i => billsOfIssue(i.id)).map(x => String(x.id)).filter(id => id !== String(b.id) && !compIds.has(id)));
  const inIssue = all.filter(d => sameIds.has(String(d.bill_id))).sort(newest);
  const cats = [...new Set(issues.map(i => i.category).filter(Boolean))];
  const near = wordsOf([...issues.map(i => i.name), b.nickname].join(' '));
  const others = (S.issues || []).filter(i => !i.archived_at && cats.includes(i.category) && !issueIds.has(i.id)).map(i => {
    const ids = new Set(billsOfIssue(i.id).map(x => String(x.id)).filter(id => id !== String(b.id) && !compIds.has(id) && !sameIds.has(id)));
    const rows = all.filter(d => ids.has(String(d.bill_id))).sort(newest);
    return { i, rows, bills: new Set(rows.map(d => String(d.bill_id))).size, near: shared(near, wordsOf(i.name)) };
  }).filter(o => o.rows.length).sort((p, q) => q.near - p.near || q.rows.length - p.rows.length || p.i.name.localeCompare(q.i.name));
  // The one to open first: the newest filed or approved on this bill or its twin, else the newest in its issue.
  const done = r => r.find(d => ['filed', 'approved'].includes(d.status)) || r[0];
  const start = (own.length ? done(own) : inIssue.length ? done(inIssue) : null) || null;
  return { all, comps, own, issues, sameCount: sameIds.size, inIssue, cats, others, start };
}
// What the Next up link counts: the parts that are open on arrival (the category is folded).
export const earlierCount = b => { const m = model(b); return m.own.length + m.inIssue.length; };
export const testimonyHref = b => `#/bill/${b.bill_number}/testimony`;
// Said once (A-14): the Next up card carries a bill's own drafts while they are unfinished, and a filed one only on the
// card of a hearing still ahead. Once the hearing has passed, a filed draft lives here and nowhere else.
export const onNextUp = d => d.status !== 'cancelled' && d.status !== 'filed';

// ---- rows ----
// A chip only for the exceptions: nearly everything here is filed, and a column of identical chips says nothing.
const STATUS = { approved: ['Approved', 'info', 'badge-check'], review: ['In review', '', 'hourglass'],
  second_review: ['Needs 2nd approval', '', 'hourglass'], draft: ['Back to draft', '', 'pencil'] };
const statusChip = d => STATUS[d.status] ? chip(...STATUS[d.status]) : '';
const whereOf = d => `${cmteFull(d.committee)}${codesOf(d.committee).length > 1 ? ' joint' : ''} hearing`;
function byLine(d) {
  const a = advocate(d.status === 'filed' ? (d.filed_by || d.submitted_by) : d.submitted_by);
  return a ? `${d.status === 'filed' ? 'Filed' : 'Sent'} by ${esc(firstName(a))}` : '';
}
// Each piece of the line stays whole when the line wraps.
const bits = arr => arr.filter(Boolean).map(t => `<span class="tm-i">${t}</span>`).join('<span aria-hidden="true"> · </span>');
const docLink = d => d.doc_url ? btn('Open Doc', { kind: 'text', icon: 'file-text', href: d.doc_url, target: '_blank' }) : '';
const confLink = d => d.filed_url ? btn('Confirmation', { kind: 'text', icon: 'external-link', href: d.filed_url, target: '_blank' }) : '';
const markOf = d => d.status === 'filed' ? 'Newest filed' : d.status === 'approved' ? 'Newest approved' : 'Newest';
function fullRow(d, b, start) {
  const other = String(d.bill_id) !== String(b.id) ? billById(d.bill_id) : null;
  return `<article class="tm-row">
    ${d === start ? `<p class="tm-mark">${markOf(d)}</p>` : ''}
    <div class="tm-top"><p class="tm-where"><b>${esc(whereOf(d))}</b>${other ? ` <span class="tm-on">on ${esc(other.bill_number)}</span>` : ''}</p>${statusChip(d)}</div>
    <p class="small muted tm-meta">${bits([esc(dayYear(whenOf(d))), d.version ? `on ${esc(d.version)}` : '', byLine(d)])}</p>
    <div class="bw-links tm-links">${docLink(d)}${confLink(d)}</div>
  </article>`;
}
function compactRow(d, start) {
  // the separator travels with the first piece, so a wrapped line never ends in a lone "·"
  const rest = bits([d.version ? `on ${esc(d.version)}` : '', byLine(d)]).replace('<span class="tm-i">', '<span class="tm-i"><span aria-hidden="true">· </span>');
  return `<div class="tm-crow">
    <span class="tm-date">${esc(dayYear(whenOf(d)))}</span>
    <p class="tm-cw">${d === start ? `<span class="tm-mark">${markOf(d)}</span>` : ''}<b>${esc(whereOf(d))}</b>${rest ? ` <span class="muted">${rest}</span>` : ''}</p>
    <span class="tm-acts">${statusChip(d)}${docLink(d)}</span>
  </div>`;
}
// Grouped by bill, the bill with the newest draft first. The bill's name is left out where it only repeats the issue.
function byBill(rows, start, issueName = '') {
  const groups = new Map();
  for (const d of rows) { const k = String(d.bill_id); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(d); }
  const same = (x, y) => String(x).trim().toLowerCase() === String(y).trim().toLowerCase();
  return [...groups.entries()].map(([id, ds]) => {
    const x = billById(id), name = x ? billName(x) : '';
    return `<div class="tm-group"><p class="tm-ghead"><a href="#/bill/${esc(x?.bill_number || '')}">${esc(x?.bill_number || 'A bill')}</a>${name && !same(name, issueName) ? `<span>${esc(name)}</span>` : ''}</p>${ds.map(d => compactRow(d, start)).join('')}</div>`;
  }).join('');
}

// ---- the tab ----
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
function body(b) {
  const m = model(b);
  if (!m.all.length) return empty({ h: 'h3', title: 'No testimony yet',
    text: 'From January the tracker starts a Google Doc for every hearing on a bill with a position. Once a draft has been sent for review it is listed here, with the testimony on the other bills in this issue.' });
  const twin = m.comps.length ? ` and its companion ${m.comps.map(x => esc(x.bill_number)).join(', ')}` : '';
  let h = `<section class="tm-part" aria-labelledby="tm-own-h"><h3 id="tm-own-h">On ${esc(b.bill_number)}${twin}</h3>
    ${m.own.length ? '' : `<p class="small muted">No earlier testimony yet.${m.start ? ' The newest in its issue is marked below.' : ''}</p>`}
    ${m.own.length ? `<div class="tm-rows">${m.own.map(d => fullRow(d, b, m.start)).join('')}</div>` : ''}</section>`;
  if (m.issues.length) {
    const names = m.issues.map(i => `"${esc(i.name)}"`).join(' and ');
    h += `<section class="tm-part" aria-labelledby="tm-iss-h"><h3 id="tm-iss-h">Other bills in ${names}</h3>
      <p class="small muted">${m.inIssue.length ? `${plural(m.inIssue.length, 'draft', 'drafts')} on ${plural(new Set(m.inIssue.map(d => String(d.bill_id))).size, 'bill', 'bills')}.`
        : m.sameCount ? `No testimony on the other ${plural(m.sameCount, 'bill', 'bills')} in this issue yet.` : 'This is the only bill in its issue so far.'}</p>
      ${m.inIssue.length ? `<div class="tm-rows">${byBill(m.inIssue, m.start, m.issues.length === 1 ? m.issues[0].name : '')}</div>` : ''}</section>`;
  } else h += `<section class="tm-part"><p class="small muted">This bill has no issue yet, so testimony on similar bills can't be found. <a href="#/bill/${esc(b.bill_number)}/public">Give it one on the Public tab</a>.</p></section>`;
  h += `<section class="tm-part" role="search" aria-labelledby="tm-q-h"><h3 id="tm-q-h"><label for="tm-q">Search the ${plural(m.all.length, 'draft', 'drafts')} made in the tracker</label></h3>
    <div class="tm-search">${icon('search')}<input id="tm-q" type="search" autocomplete="off" placeholder="A bill, committee, issue or person" value="${esc(S.tmQuery || '')}"></div>
    <div id="tm-res" aria-live="polite">${results(S.tmQuery || '', b)}</div></section>`;
  if (m.others.length) {
    const cat = m.cats.map(k => catByKey(k)?.name || k).join(' and ');
    h += `<section class="tm-part" aria-labelledby="tm-cat-h"><h3 id="tm-cat-h">More in ${esc(cat)}</h3>
      <p class="small muted">${plural(m.others.length, 'other issue', 'other issues')} with testimony, nearest first. Open one to see it.</p>
      <div class="tm-cat">${m.others.map(o => `<details class="tm-iss"><summary><b>${esc(o.i.name)}</b><span>${plural(o.rows.length, 'draft', 'drafts')} on ${plural(o.bills, 'bill', 'bills')}</span>${icon('chevron-right')}</summary>
        <div class="tm-rows">${byBill(o.rows, null, o.i.name)}</div></details>`).join('')}</div></section>`;
  }
  return h;
}
// Search the words staff would type: the bill number, its name, the committee, the issue, who wrote or filed it. It
// covers the tracker's drafts only, and says so when nothing matches (P-4).
function results(q, b) {
  q = String(q || '').trim().toLowerCase(); if (q.length < 2) return '';
  const words = q.split(/\s+/);
  const hay = d => { const x = billById(d.bill_id);
    return [x?.bill_number, x?.bill_number?.replace(/^([A-Z]+)/, '$1 '), x ? billName(x) : '', whereOf(d), d.committee, d.version, STATUS[d.status]?.[0] || 'filed',
      ...issuesOfBill(d.bill_id).map(i => i.name), advocate(d.submitted_by)?.full_name, advocate(d.filed_by)?.full_name].join(' ').toLowerCase(); };
  const hits = allWorked().filter(d => words.every(w => hay(d).includes(w))).sort(newest);
  if (!hits.length) return `<p class="small muted tm-none">Nothing in the tracker's drafts matches "${esc(q)}". Testimony from before the tracker is on each bill's Capitol page${b ? `: <a href="${esc(capitolUrl(b))}" target="_blank" rel="noopener">${esc(b.bill_number)} at the Capitol</a>` : ''}.</p>`;
  const shown = hits.slice(0, 40);
  return `<p class="small muted">${plural(hits.length, 'draft', 'drafts')} found${hits.length > shown.length ? `, the newest ${shown.length} shown` : ''}.</p><div class="tm-rows">${byBill(shown, null)}</div>`;
}

// The older hearings a draft points to arrive after the first paint; only the tab's body is redrawn, so a search
// being typed keeps its focus.
let fetched = false;
function ensure() {
  if (DEMO || fetched || !DB.loadDraftHearings) return;
  fetched = true;
  DB.loadDraftHearings().then(changed => { if (changed) refresh(); }).catch(e => console.warn('testimony hearings:', e));
}
function refresh() {
  const box = document.getElementById('tm-body'); if (!box) return;
  const b = billById(box.dataset.bill); if (!b) return;
  const had = document.activeElement?.id === 'tm-q';
  box.innerHTML = body(b); wireTestimony(box, b);
  if (had) { const q = document.getElementById('tm-q'); q?.focus(); q?.setSelectionRange(q.value.length, q.value.length); }
}

export function renderTestimony(b) {
  ensure();
  return `<section class="bw-sec tm" aria-labelledby="tm-h"><h2 id="tm-h" class="sr">Testimony</h2>
    <div id="tm-body" data-bill="${esc(b.id)}">${body(b)}</div></section>`;
}
export function wireTestimony(pnl, b) {
  const q = pnl.querySelector('#tm-q'), res = pnl.querySelector('#tm-res');
  // The query is kept for the visit (B-6): a trip to another bill and back finds it where it was.
  if (q && res) q.addEventListener('input', () => { S.tmQuery = q.value; res.innerHTML = results(q.value, b); });
}
