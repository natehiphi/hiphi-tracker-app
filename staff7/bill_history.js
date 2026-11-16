// The bill page's Part B (R-398): Team notes, Past hearings and History, after the facts and in the same content width. Read only: nothing here writes.
// The data comes from bill_data.js (asked for once, 'loading' then drawn again); until it lands the three blocks are one quiet line, and if it fails Team notes (which need only memory) are drawn with a failure line where Past hearings and History would be. The top of the page never waits.
// Every "Show all" is a button with data-bmore; the lists are always drawn in full with the extra rows hidden, so opening one changes nothing else, and the open state is kept in bill.js's `bui`
// (the minute's redraw keeps it).
// Part C's note box (bill_edit.js) sits at the top of the notes. The order: Hearings and votes so far, Team notes, More from the Capitol’s page (closed), History.
import { S, POSITIONS, DEMO, SESSION_YEAR } from '../staff6/data.js';
import { plainAction } from '../staff6/model.js';
import { ic } from './icons7.js';
import { esc, btn } from './parts.js';
import { first } from './steps.js';
import { draftFor, http, dateY, codesKey, cmtesLinks, cmtesText, cleanCodes, ext } from './bill_words.js';
import { floorVotes } from './bill_floor.js';
import { capitolHTML } from './bill_more.js';
import { isCarry } from '../staff6/model.js';
import { billExtras, retry, memoryExtras } from './bill_data.js';
import { bui } from './bill.js';
import { noteBoxHTML } from './bill_edit.js';
import { eCig } from './issues.js';

const HST = { timeZone: 'Pacific/Honolulu' };
const ymd = t => new Date(t).toLocaleDateString('en-CA', HST);
const day = t => dateY(ymd(t));   // "Thu, Mar 13", and "Thu, Mar 13, 2025" for a day that is not in the session's year
const short = t => { const w = new Date(t).toLocaleDateString('en-US', { ...HST, month: 'short', day: 'numeric' }), y = ymd(t).slice(0, 4); return +y === +SESSION_YEAR ? w : `${w}, ${y}`; };
const nameOf = id => first(S.advocates.find(a => a.id === id));

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

// A list drawn in full, its rows after `lim` hidden, and one control for it. `name` says which list the control is for ("notes", "past hearings"), for a screen reader.
function list(key, b, rows, lim, name, cls = '') {
  const k = `${key}|${b.id}`, open = bui.open.has(k), id = `bl-${key}`, extra = rows.length - lim, all = `Show all ${rows.length} ${name}`, few = `Show fewer ${name}`;
  const lis = rows.map((h, i) => `<li${i >= lim ? ` class="bx"${open ? '' : ' hidden'}` : ''}>${h}</li>`).join('');
  const vis = key === 'notes' ? all : `Show all ${rows.length}`;
  const ctl = extra > 0 ? `<p class="bmore">${btn(open ? 'Show fewer' : vis, { kind: 'text', attrs: `data-bmore="${esc(k)}" data-show="${esc(vis)}" data-all="${esc(all)}" data-few="${esc(few)}" aria-label="${esc(open ? few : all)}" aria-controls="${id}" aria-expanded="${open}"` })}</p>` : '';
  return `<ul class="blog${cls}" id="${id}">${lis}</ul>${ctl}`;
}

// ---------------------------------------------------------------------------------- Team notes
// Needs only what is in memory, so it is drawn even when the rest of the history could not be loaded
function notesBlock(b, x) {
  const msgs = x.messages.slice().sort((p, q) => String(q.created_at).localeCompare(String(p.created_at)));
  const body = t => esc(eCig(t)).replace(/\n/g, '<br>');
  const pin = x.pinned ? `<div class="bnote pin" id="bPinned"><small>Pinned</small><p>${body(x.pinned)}</p></div>` : '';
  const items = msgs.map(m => `<div class="bnote"><small>${esc(nameOf(m.advocate_id))} · ${esc(day(m.created_at))}</small><p>${body(m.body)}</p></div>`);
  return `<h2 class="sh" id="bNotesH">Team notes</h2>${DEMO ? '' : '<p class="hint" id="bNotes90">Notes from the last 90 days.</p>'}${noteBoxHTML(b)}${pin}${items.length ? list('notes', b, items, 2, 'notes', ' bnl') : pin ? '' : '<p class="hint" id="bNoNotes">No notes yet.</p>'}`;   // the data layer loads a bill's conversation for 90 days only
}

// ---------------------------------------------------------------------------------- Past hearings
function hearingsBlock(b, x) {
  const now = Date.now(), all = x.hearings.slice(), future = h => new Date(h.scheduled_at).getTime() > now;
  const ahead = h => h.status === 'scheduled' && future(h);
  // a cancelled or moved row for a committee that has a hearing ahead that same day was replaced by it: not a hearing of its own
  const replaced = h => h.status !== 'scheduled' && all.some(o => o !== h && ahead(o) && codesKey(o.committee) === codesKey(h.committee) && ymd(o.scheduled_at) === ymd(h.scheduled_at));
  const past = all.filter(h => !future(h) && !replaced(h)).sort((p, q) => String(p.scheduled_at).localeCompare(String(q.scheduled_at)));   // a hearing dated ahead, whatever its status, is not a past one
  // one result can be recorded against a hearing and the vote on it a few days later (a hearing, then decision making): those are one row, dated by the first
  const groups = []; const by = new Map();
  for (const h of past) {
    const o = x.outcomes[h.id], k = o && h.status === 'scheduled' ? `${codesKey(h.committee)}|${o.reported_at}|${o.outcome}` : h.id;
    if (by.has(k)) by.get(k).hs.push(h); else { const g = { hs: [h], o: h.status === 'scheduled' ? o : null }; by.set(k, g); groups.push(g); }
  }
  const floors = floorVotes(x.timeline);
  if (!groups.length && !floors.length) return '';
  const hearRows = groups.map(g => {
    const h = g.hs[0], o = g.o, st = STATUS[h.status] || (h.status !== 'scheduled' ? String(h.status).replace(/_/g, ' ').replace(/^./, c => c.toUpperCase()) : '');
    const did = st || (o && OUTCOME[o.outcome] ? OUTCOME[o.outcome] + (o.reported_at && ymd(o.reported_at) !== ymd(h.scheduled_at) && /^passed/.test(o.outcome) ? ` on ${short(o.reported_at)}` : '') : 'No result recorded');
    const vote = !st && o && !String(h.committee || '').includes('/') ? voteWords(o.report) : '';   // a joint hearing's sentence holds more than one committee's vote: no count is shown
    let ours = '', link = '';
    if (!st) {
      const ds = g.hs.map(hh => draftFor(hh, b)).filter(Boolean), d = ds.find(z => z.status === 'filed') || null;
      // our testimony: a link to its Doc and who filed it, or that we did not file
      ours = d ? `${http(d.doc_url) ? ext(d.doc_url, 'Our testimony') : 'Our testimony'}${d.filed_by ? `, filed by ${esc(nameOf(d.filed_by))}` : ', filed'}` : 'we did not file';
      if (d && http(d.filed_url)) link = `<a class="lk" target="_blank" rel="noopener" href="${esc(d.filed_url)}">Everyone’s testimony${ic('external-link')}</a>`;
    }
    return { t: h.scheduled_at, html: `<span class="bh1">${esc(day(h.scheduled_at))} · ${cmtesLinks(h.committee, b)}</span><small>${[esc(did), vote ? esc(vote) : '', ours, link].filter(Boolean).join(' · ')}</small>` };
  });
  // a floor vote the Capitol's lines give: "Fri, Mar 6 · House floor, third reading", then "Passed" and the counts only when they were read in full
  const floorRows = floors.map(f => ({ t: f.t, html: `<span class="bh1">${esc(day(f.t))} · ${f.chamber} floor, third reading</span><small>${esc(['Passed', f.counts].filter(Boolean).join(' · '))}</small>` }));
  const rows = [...hearRows, ...floorRows].sort((p, q) => String(q.t).localeCompare(String(p.t))).map(r => r.html);
  // a carried-over bill whose hearings from before this year are not in the list: they are in History
  const old = isCarry(b) && !x.hearings.some(h => new Date(h.scheduled_at).getTime() < new Date(`${SESSION_YEAR}-01-01T00:00:00-10:00`).getTime());
  return `<h2 class="sh" id="bHearH">Hearings and votes so far</h2>${old ? `<p class="bhn" id="bHearOld">Hearings before ${esc(SESSION_YEAR)} are in History.</p>` : ''}${list('hear', b, rows, 3, 'hearings and votes')}`;
}

// ---------------------------------------------------------------------------------- History
const LOGGED = { testimony: 'logged testimony', coalition: 'logged a coalition entry', meeting: 'logged a meeting', action_alert: 'logged a supporter email' };   // the activity types the data layer's log has (LOG_TYPES, less note)
const posName = v => (v && (POSITIONS.find(p => p[0] === v) || [])[1]) || 'No position';
const clock = t => String(t).replace(/\s*([AP]M)$/i, ' $1').toUpperCase();
const iso = (m, d, y) => `${2000 + +y}-${m}-${d}`;
// The Capitol's sentences plainAction leaves raw, in plain words; anything else stays as plainAction has it
export function plainer(title, b) {
  const t = String(title || '').replace(/\s+/g, ' ').trim(), C = c => cmtesText(c, b);
  let m = /^The committee(?:\(s\))? on ([A-Z/]+) recommend(?:\(s\))? that the measure be deferred(?: until (\d\d)-(\d\d)-(\d\d)(?: at (\d{1,2}:\d\d ?[AP]M))?)?/i.exec(t);
  if (m) return `${C(m[1])} deferred it${m[2] ? ` until ${dateY(iso(m[2], m[3], m[4]))}${m[5] ? ` ${clock(m[5])}` : ''}` : ''}`;
  m = /^The committee(?:\(s\))? on ([A-Z/]+) recommend(?:\(s\))? that the measure be PASSED, (WITH AMENDMENTS|UNAMENDED)/i.exec(t);
  if (m) return `${C(m[1])} passed it${/^WITH/i.test(m[2]) ? ' with changes' : ', no changes'}`;
  m = /^The committee(?:\(s\))? on ([A-Z/]+) recommend(?:\(s\))? that the measure be held/i.exec(t);
  if (m) return `${C(m[1])} held it`;
  m = /^Bill scheduled for decision making on [A-Za-z]+, (\d\d)-(\d\d)-(\d\d) (\d{1,2}:\d\d ?[AP]M)/i.exec(t);
  if (m) { const room = /\broom (\w+)/i.exec(t); return `Decision set: ${dateY(iso(m[1], m[2], m[3]))} ${clock(m[4])}${room ? ` · Room ${room[1]}` : ''}`; }
  if (/^Introduced and Pass(?:ed)? First Reading\.?$/i.test(t)) return 'Introduced';
  if (/^Pass(?:ed)? First Reading\.?$/i.test(t)) return 'Passed first reading';
  return cleanCodes(plainAction(t)[0] || '', b).replace(/\s+/g, ' ').replace(/,\s*ref\w*(?:\s+sheet\s*\d*)?$/i, '').trim();   // the data cuts a long title: ", refe" and ", referral sheet 1" are not words for a person
}
// A hearing the Capitol set and then moved on the same day, for the same committee, is told once: the later one (the data cannot order two lines of one day)
const SETS = /has (re)?scheduled (?:its|a) public hearing|^Bill scheduled to be heard by/i, SETC = /(?:committee\(s\) on|heard by) ([A-Z/]+)/i;
// The Capitol's lines, one list: [{ t, text, ch }] newest first. The issue page (issue_notes.js) uses this same list, so both pages word history the same way.
export function capitolItems(x, b) {
  const rows = x.timeline.filter(r => !(r.advocate_id && r.source !== 'auto')).map(r => {
    const raw = String(r.title || ''), sc = SETS.test(raw) ? SETC.exec(raw) : null;
    return { r, raw, set: sc ? `${ymd(r.occurred_at)}|${codesKey(sc[1])}` : '', moved: /has rescheduled/i.test(raw) };
  });
  const keep = new Map(); for (const z of rows) if (z.set) { const k = keep.get(z.set); if (!k || (z.moved && !k.moved)) keep.set(z.set, z); }
  const seen = new Set(), out = [];
  for (const z of rows) {
    if (z.set && keep.get(z.set) !== z) continue;
    const text = plainer(z.raw, b); if (!text) continue;
    const k = `${text}|${ymd(z.r.occurred_at)}`; if (seen.has(k)) continue; seen.add(k);
    const ch = /Official action\s*-\s*(\w+)/i.exec(z.r.details || '');
    out.push({ t: z.r.occurred_at, text, ch: ch ? ch[1] : '' });
  }
  return out.sort((p, q) => String(q.t).localeCompare(String(p.t)));   // a stable sort: lines of one moment keep the order the data gave them
}
const capitolRows = (x, b) => capitolItems(x, b).map(i => `<span class="bh1">${esc(eCig(i.text))}</span><small>${esc(day(i.t))}${i.ch ? ` · ${esc(i.ch)}` : ''}</small>`);
// What a field_change row says: the database's own rows carry meta {field, old, new}; a row this page writes carries the same fields as JSON in its details
const fieldsOf = r => { if (r.meta && r.meta.field) return r.meta; try { const m = JSON.parse(r.details); return m && m.field ? m : {}; } catch { return {}; } };
// What the team did, one list: [{ t, html (words, already escaped), small }] newest first (also used by the issue page)
export function ourItems(b, x) {
  const out = [], add = (t, html, small) => { if (t) out.push({ t, html, small: small || '' }); };
  for (const r of x.timeline) {
    if (!r.advocate_id || r.source === 'auto' || /^Testimony filed with/i.test(r.title || '')) continue;   // the testimony draft says that itself, below
    const who = esc(nameOf(r.advocate_id));
    if (r.type === 'field_change') {
      const m = fieldsOf(r);
      if (m.field === 'position') add(r.occurred_at, `${who} changed the position: ${esc(posName(m.old))} to ${esc(posName(m.new))}`);
      else if (m.field === 'lead' && m.new) add(r.occurred_at, `${who} made ${esc(nameOf(m.new))} the lead`);
      else if (m.field === 'lead' && m.old) add(r.occurred_at, `${who} took the lead off ${esc(nameOf(m.old))}`);
      continue;   // priority and any other field change: left out
    }
    if (r.type === 'note') continue;   // the notes are in Team notes, just above
    if (LOGGED[r.type]) add(r.occurred_at, `${who} ${LOGGED[r.type]}`, r.title);
    else if (r.title) add(r.occurred_at, `${who} ${esc(eCig(r.title))}`);
  }
  for (const d of x.drafts) {
    if (d.status === 'cancelled') continue;
    const cm = d.committee ? `for ${cmtesText(d.committee, b)}` : '';
    if (d.submitted_at && d.submitted_by) add(d.submitted_at, `${esc(nameOf(d.submitted_by))} sent testimony for approval`, cm);
    if (d.approved_at && d.approved_by) add(d.approved_at, `${esc(nameOf(d.approved_by))} approved the testimony`, cm);
    if (d.second_approved_at && d.second_approved_by) add(d.second_approved_at, `${esc(nameOf(d.second_approved_by))} gave the testimony a second look`, cm);
    if (d.filed_at && d.filed_by) add(d.filed_at, `${esc(nameOf(d.filed_by))} filed testimony`, cm);
  }
  return out.sort((p, q) => String(q.t).localeCompare(String(p.t)));
}
const ourRows = (b, x) => ourItems(b, x).map(i => `<span class="bh1">${i.html}</span><small>${esc(day(i.t))}${i.small ? ` · ${esc(i.small)}` : ''}</small>`);
function historyBlock(b, x) {
  const cap = capitolRows(x, b), ours = ourRows(b, x), col = (key, title, rows, id, name) => `<div class="bcol" id="${id}"><h3 class="bh3">${title}</h3>${rows.length ? list(key, b, rows, 4, name) : '<p class="hint">Nothing yet.</p>'}</div>`;
  return `<h2 class="sh" id="bHistH">History</h2><div class="bhist">${col('cap', 'What the Capitol did', cap, 'bCap', 'lines of what the Capitol did')}${col('ours', 'What we did', ours, 'bOurs', 'lines of what we did')}</div>`;
}

// ---------------------------------------------------------------------------------- the part
export function partB(b) {
  const x = billExtras(b);
  if (x === 'loading') return '<p class="hint bwait" id="bWait">Loading the bill’s history.</p>';
  // the notes need only memory: they are drawn even when the rest could not be loaded, and the failure takes the place of Past hearings and History
  if (x === 'failed') return `<div class="bparts" id="bParts" data-bill="${esc(b.id)}">${notesBlock(b, memoryExtras(b))}${capitolHTML(b, [])}<p class="hint bwait" id="bFail">We could not load the bill’s history. ${btn('Try again', { kind: 'text', id: 'bRetry', attrs: `data-bill="${esc(b.id)}"` })}</p></div>`;
  return `<div class="bparts" id="bParts" data-bill="${esc(b.id)}">${hearingsBlock(b, x)}${notesBlock(b, x)}${capitolHTML(b, x.timeline)}${historyBlock(b, x)}</div>`;
}
export function bindPartB() {
  document.querySelectorAll('button[data-bmore]').forEach(bt => bt.addEventListener('click', () => {
    const on = bt.getAttribute('aria-expanded') !== 'true', k = bt.dataset.bmore, ul = document.getElementById(bt.getAttribute('aria-controls'));
    if (on) bui.open.add(k); else bui.open.delete(k);
    bt.setAttribute('aria-expanded', String(on)); bt.textContent = on ? 'Show fewer' : bt.dataset.show; bt.setAttribute('aria-label', on ? bt.dataset.few : bt.dataset.all);
    ul?.querySelectorAll('li.bx').forEach(li => { li.hidden = !on; });
  }));
  const r = document.getElementById('bRetry');
  if (r) r.addEventListener('click', () => { const b = S.bills.find(z => z.id === r.dataset.bill); if (b) retry(b); });
}
