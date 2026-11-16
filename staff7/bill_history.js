// The bill page's Part B (R-398): Team notes, Past hearings and History, after the facts and in the same content width. Read only: nothing here writes.
// The data comes from bill_data.js (asked for once, 'loading' then drawn again); until it lands, or if it fails, the three blocks are one quiet line, and the top of the page never waits for it.
// Every "Show all" is a button with data-bmore; the lists are always drawn in full with the extra rows hidden, so opening one changes nothing else, and the open state is kept in bill.js's `bui`
// (the minute's redraw keeps it).
// Seam for Part C: noteAddSlot, above the notes (the box and "Add the note").
import { S } from '../staff6/data.js';
import { plainAction } from '../staff6/model.js';
import { POSITIONS } from '../staff6/data.js';
import { ic } from './icons7.js';
import { esc, btn } from './parts.js';
import { cmteWords, first } from './steps.js';
import { dateWords } from './words.js';
import { draftFor } from './bill_words.js';
import { billExtras, retry } from './bill_data.js';
import { bui } from './bill.js';
import { eCig, clean } from './issues.js';

const enc = encodeURIComponent;
const HST = { timeZone: 'Pacific/Honolulu' };
const ymd = t => new Date(t).toLocaleDateString('en-CA', HST);
const day = t => dateWords(ymd(t));
const short = t => new Date(t).toLocaleDateString('en-US', { ...HST, month: 'short', day: 'numeric' });
const http = u => /^https?:\/\//i.test(String(u || '').trim());
const nameOf = id => first(S.advocates.find(a => a.id === id));
const noteAddSlot = () => '';   // Part C: the box and "Add the note"

// ---------------------------------------------------------------------------------- the Capitol's vote sentence
// Counts only, never names. The sentence comes in at least two forms ("4 Aye(s): ...; 0 No(es): none; and 1 Excused: ..." and "7 Ayes: ...; Noes: none; and 2 Excused: ...") and the data cuts it at 300 letters,
// so a count that cannot be read in full means no vote is shown at all: never a wrong or a partial one. "with reservations" is said only when its own count is stated.
export function voteWords(report) {
  const t = String(report || '').replace(/\s+/g, ' '), at = t.search(/votes/i); if (at < 0) return '';
  const v = t.slice(at), num = (re, none) => { const m = re.exec(v); return m ? +m[1] : none && none.test(v) ? 0 : null; };
  const yes = num(/(\d+)\s+Aye(?:s|\(s\))?\s*:/i, /\bAye(?:s|\(s\))?\s*:\s*none/i), no = num(/(\d+)\s+No(?:es|\(es\))?\s*:/i, /\bNo(?:es|\(es\))?\s*:\s*none/i), ex = num(/(\d+)\s+Excused\s*:/i, /Excused\s*:\s*none/i);
  if (yes == null || no == null || ex == null) return '';
  const res = num(/(\d+)\s+Aye(?:s|\(s\))?\s+with reservations/i, /with reservations\s*:\s*none/i);
  return `${yes} yes, ${no} no, ${ex} excused${res ? ` (${res} with reservations)` : ''}`;
}
const OUTCOME = { passed: 'Passed, no changes', passed_amended: 'Passed with changes', deferred: 'Deferred', held: 'Held' };
const STATUS = { cancelled: 'Cancelled', moved: 'Moved', deferred: 'Deferred' };
const cmteLink = c => S.committees?.[c] ? `<a class="lk" href="#/search/committee/${enc(c)}">${esc(cmteWords(c))}</a>` : esc(cmteWords(c));
const cmtesLinks = codes => String(codes || '').split('/').map(c => c.trim()).filter(Boolean).map(cmteLink).join(' with ');

// A list drawn in full, its rows after `lim` hidden, and one control for it
function list(key, b, rows, lim, noun, cls = '') {
  const k = `${key}|${b.id}`, open = bui.open.has(k), id = `bl-${key}`, extra = rows.length - lim;
  const lis = rows.map((h, i) => `<li${i >= lim ? ` class="bx"${open ? '' : ' hidden'}` : ''}>${h}</li>`).join('');
  const ctl = extra > 0 ? `<p class="bmore">${btn(open ? 'Show fewer' : `Show all ${rows.length}${noun ? ' ' + noun : ''}`, { kind: 'text', attrs: `data-bmore="${esc(k)}" data-show="${esc(`Show all ${rows.length}${noun ? ' ' + noun : ''}`)}" aria-controls="${id}" aria-expanded="${open}"` })}</p>` : '';
  return `<ul class="blog${cls}" id="${id}">${lis}</ul>${ctl}`;
}

// ---------------------------------------------------------------------------------- Team notes
function notesBlock(b, x) {
  const msgs = x.messages.slice().sort((p, q) => String(q.created_at).localeCompare(String(p.created_at)));
  const body = t => esc(eCig(t)).replace(/\n/g, '<br>');
  const pin = x.pinned ? `<div class="bnote pin" id="bPinned"><small>Pinned</small><p>${body(x.pinned)}</p></div>` : '';
  const items = msgs.map(m => `<div class="bnote"><small>${esc(nameOf(m.advocate_id))} · ${esc(day(m.created_at))}</small><p>${body(m.body)}</p></div>`);
  return `<h2 class="sh" id="bNotesH">Team notes</h2>${noteAddSlot(b)}${pin}${items.length ? list('notes', b, items, 2, 'notes', ' bnl') : pin ? '' : '<p class="hint" id="bNoNotes">No notes yet.</p>'}`;
}

// ---------------------------------------------------------------------------------- Past hearings
function hearingsBlock(b, x) {
  const now = Date.now(), all = x.hearings.slice();
  const ahead = h => h.status === 'scheduled' && new Date(h.scheduled_at).getTime() > now;
  // a cancelled or moved row for a committee that has a hearing ahead that same day was replaced by it: not a hearing of its own
  const replaced = h => h.status !== 'scheduled' && all.some(o => o !== h && ahead(o) && o.committee === h.committee && ymd(o.scheduled_at) === ymd(h.scheduled_at));
  const past = all.filter(h => !ahead(h) && !replaced(h)).sort((p, q) => String(p.scheduled_at).localeCompare(String(q.scheduled_at)));
  // one result can be recorded against a hearing and the vote on it a few days later (a hearing, then decision making): those are one row, dated by the first
  const groups = []; const by = new Map();
  for (const h of past) {
    const o = x.outcomes[h.id], k = o && h.status === 'scheduled' ? `${h.committee}|${o.reported_at}|${o.outcome}` : h.id;
    if (by.has(k)) by.get(k).hs.push(h); else { const g = { hs: [h], o: h.status === 'scheduled' ? o : null }; by.set(k, g); groups.push(g); }
  }
  if (!groups.length) return '';
  const rows = groups.sort((p, q) => String(q.hs[0].scheduled_at).localeCompare(String(p.hs[0].scheduled_at))).map(g => {
    const h = g.hs[0], o = g.o, st = STATUS[h.status] || (h.status !== 'scheduled' ? esc(String(h.status).replace(/_/g, ' ').replace(/^./, c => c.toUpperCase())) : '');
    const did = st || (o && OUTCOME[o.outcome] ? OUTCOME[o.outcome] + (o.reported_at && ymd(o.reported_at) !== ymd(h.scheduled_at) && /^passed/.test(o.outcome) ? ` on ${short(o.reported_at)}` : '') : 'No result recorded');
    const vote = !st && o ? voteWords(o.report) : '';
    let ours = '', link = '';
    if (!st) {
      const ds = g.hs.map(hh => draftFor(hh, b)).filter(Boolean), d = ds.find(z => z.status === 'filed') || null;
      ours = d ? (d.filed_by ? `${esc(nameOf(d.filed_by))} filed our testimony` : 'we filed our testimony') : 'we did not file';
      if (d && http(d.filed_url)) link = `<a class="lk" target="_blank" rel="noopener" href="${esc(d.filed_url)}">Everyone’s testimony${ic('external-link')}</a>`;
    }
    return `<span class="bh1">${esc(day(h.scheduled_at))} · ${cmtesLinks(h.committee)}</span><small>${[esc(did), vote ? esc(vote) : '', ours, link].filter(Boolean).join(' · ')}</small>`;
  });
  return `<h2 class="sh" id="bHearH">Past hearings</h2>${list('hear', b, rows, 3, '')}`;
}

// ---------------------------------------------------------------------------------- History
const LOGGED = { testimony: 'logged testimony', coalition: 'logged a coalition entry', meeting: 'logged a meeting', action_alert: 'logged a supporter email', call: 'logged a call', email: 'logged an email' };
const posName = v => (POSITIONS.find(p => p[0] === v) || [])[1] && v ? POSITIONS.find(p => p[0] === v)[1] : 'No position';
function capitolRows(x) {
  const seen = new Set(), out = [];
  for (const r of x.timeline) {
    if (r.advocate_id && r.source !== 'auto') continue;
    const text = clean(plainAction(String(r.title || ''))[0] || '').replace(/\s+/g, ' ').replace(/,\s*ref\w*(?:\s+sheet\s*\d*)?$/i, '').trim();   // the data cuts a long title: ", refe" and ", referral sheet 1" are not words for a person if (!text) continue;
    const k = `${text}|${ymd(r.occurred_at)}`; if (seen.has(k)) continue; seen.add(k);
    const ch = /Official action\s*-\s*(\w+)/i.exec(r.details || '');
    out.push({ t: r.occurred_at, html: `<span class="bh1">${esc(eCig(text))}</span><small>${esc(day(r.occurred_at))}${ch ? ` · ${esc(ch[1])}` : ''}</small>` });
  }
  return out.sort((p, q) => String(q.t).localeCompare(String(p.t))).map(r => r.html);
}
function ourRows(b, x) {
  const out = [], add = (t, html, small) => { if (t) out.push({ t, html: `<span class="bh1">${html}</span><small>${esc(day(t))}${small ? ` · ${esc(small)}` : ''}</small>` }); };
  for (const r of x.timeline) {
    if (!r.advocate_id || r.source === 'auto') continue;
    const who = esc(nameOf(r.advocate_id));
    if (r.type === 'field_change') {
      const m = r.meta || {};
      if (m.field === 'position') add(r.occurred_at, `${who} changed the position: ${esc(posName(m.old))} to ${esc(posName(m.new))}`);
      else if (m.field === 'lead' && m.new) add(r.occurred_at, `${who} made ${esc(nameOf(m.new))} the lead`);
      continue;   // priority and any other field change: left out
    }
    if (r.type === 'note') add(r.occurred_at, `${who} added a note`, r.title);
    else if (LOGGED[r.type]) add(r.occurred_at, `${who} ${LOGGED[r.type]}`, r.title);
    else if (r.title) add(r.occurred_at, `${who} ${esc(eCig(r.title))}`);
  }
  for (const d of x.drafts) {
    if (d.status === 'cancelled') continue;
    const cm = d.committee ? `for ${cmteWords(d.committee)}` : '';
    if (d.submitted_at && d.submitted_by) add(d.submitted_at, `${esc(nameOf(d.submitted_by))} sent testimony for approval`, cm);
    if (d.approved_at && d.approved_by) add(d.approved_at, `${esc(nameOf(d.approved_by))} approved the testimony`, cm);
    if (d.second_approved_at && d.second_approved_by) add(d.second_approved_at, `${esc(nameOf(d.second_approved_by))} gave the testimony a second look`, cm);
    if (d.filed_at && d.filed_by) add(d.filed_at, `${esc(nameOf(d.filed_by))} filed testimony`, cm);
  }
  for (const m of x.messages) add(m.created_at, `${esc(nameOf(m.advocate_id))} added a note`);
  return out.sort((p, q) => String(q.t).localeCompare(String(p.t))).map(r => r.html);
}
function historyBlock(b, x) {
  const cap = capitolRows(x), ours = ourRows(b, x), col = (key, title, rows, id) => `<div class="bcol" id="${id}"><h3 class="bh3">${title}</h3>${rows.length ? list(key, b, rows, 4, '') : '<p class="hint">Nothing yet.</p>'}</div>`;
  return `<h2 class="sh" id="bHistH">History</h2><div class="bhist">${col('cap', 'What the Capitol did', cap, 'bCap')}${col('ours', 'What we did', ours, 'bOurs')}</div>`;
}

// ---------------------------------------------------------------------------------- the part
export function partB(b) {
  const x = billExtras(b);
  if (x === 'loading') return '<p class="hint bwait" id="bWait">Loading the bill’s history.</p>';
  if (x === 'failed') return `<p class="hint bwait" id="bFail">We could not load the bill’s history. ${btn('Try again', { kind: 'text', id: 'bRetry', attrs: `data-bill="${esc(b.id)}"` })}</p>`;
  return `<div class="bparts" id="bParts" data-bill="${esc(b.id)}">${notesBlock(b, x)}${hearingsBlock(b, x)}${historyBlock(b, x)}</div>`;
}
export function bindPartB() {
  document.querySelectorAll('button[data-bmore]').forEach(bt => bt.addEventListener('click', () => {
    const on = bt.getAttribute('aria-expanded') !== 'true', k = bt.dataset.bmore, ul = document.getElementById(bt.getAttribute('aria-controls'));
    if (on) bui.open.add(k); else bui.open.delete(k);
    bt.setAttribute('aria-expanded', String(on)); bt.textContent = on ? 'Show fewer' : bt.dataset.show;
    ul?.querySelectorAll('li.bx').forEach(li => { li.hidden = !on; });
  }));
  const r = document.getElementById('bRetry');
  if (r) r.addEventListener('click', () => { const b = S.bills.find(z => z.id === r.dataset.bill); if (b) retry(b); });
}
