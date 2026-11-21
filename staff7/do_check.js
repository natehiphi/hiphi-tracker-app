// R-398 piece 9 gap B: the position changed after a testimony was approved (or while it waits for approval). The testimony still argues the old position, so:
//   - the bill page warns (an amber strip), the File testimony step is held, and the testimony's writer gets the step "Check your testimony" (this file's page);
//   - it ends by itself (S-10): the position goes back, the testimony is approved again after the change, or the hearing passes. Nothing here is ever "dismissed" by hand except Keep it as written (same side only).
// Data: a draft carries no position, so "approved before the position changed" is worked out from the bill's position-change TIMES against the draft's approval time.
//   Practice copy: bill_edit.js calls noteChange() after a position save; the log is kept in this tab (sessionStorage, like staff7's other practice-only state).
//   Live (later): warmPosLog() reads the database trigger's own rows (activity_log type 'field_change', meta field 'position', written by log_bill_field_changes on every team position change).
// No database column, no new SQL. Looking never changes anything; only the buttons on the check page do.
import { S, DB, DEMO, advocate } from '../staff6/data.js';
import { draftHearing } from '../staff6/model.js';
import { band, btn, esc, toast } from './parts.js';
import { ic } from './icons7.js';
import { first, hearingLine, dayTime, posWords, issueOf, billName, billNo, leadsFor } from './steps.js';
import { approvedLine, letterRow, bindLetterRow } from './do_file.js';
import { testimonyDue, onHold, draftFor } from './bill_words.js';

const enc = encodeURIComponent;
// The two sides a testimony can argue (staff6/bill.js SIDE, the same map); a position with no side (Comments, Monitor, none) is its own.
const SIDE = { strongly_support: 'support', support: 'support', support_amend: 'support', strongly_oppose: 'oppose', oppose: 'oppose' };
const side = p => SIDE[p] || (p ? `other:${p}` : 'none');
const label = p => posWords({ position: p });

// ---------------------------------------------------------------------------------- the position-change record
const KEY = 'hiphi7_poschk';
const store = (() => { try { const s = JSON.parse(sessionStorage.getItem(KEY)); if (s && s.log && s.kept) return s; } catch { /* fresh */ } return { log: {}, kept: {} }; })();
const persist = () => { try { sessionStorage.setItem(KEY, JSON.stringify(store)); } catch { /* it still works in memory */ } };
const rows = new Map();   // live: bill id -> [{ at, from, to }] read from activity_log
// A position was saved on this bill: its time and the position before it.
export function noteChange(b, from, to) { (store.log[b.id] ??= []).push({ at: Date.now(), from: from || null, to: to || null }); persist(); }
// Undo of that save: the record goes with it.
export function dropChange(b) { const l = store.log[b.id]; if (l?.length) { l.pop(); persist(); } }
// Live: the team's position changes for the bills that have approved or waiting testimony. (staff7 is practice-only today, so this returns at once; it is the read the live app needs.)
export async function warmPosLog(after) {
  if (DEMO || !S.supa) return;
  const ids = (S.bills || []).filter(b => (S.drafts?.[b.id] || []).some(d => ['approved', 'review', 'second_review'].includes(d.status))).map(b => b.id); if (!ids.length) return;
  const { data, error } = await S.supa.from('activity_log').select('bill_id,occurred_at,meta').eq('type', 'field_change').filter('meta->>field', 'eq', 'position').in('bill_id', ids).order('occurred_at');
  if (error) return;
  rows.clear(); for (const r of data || []) (rows.get(r.bill_id) ?? rows.set(r.bill_id, []).get(r.bill_id)).push({ at: new Date(r.occurred_at).getTime(), from: r.meta?.old ?? null, to: r.meta?.new ?? null });
  after?.();
}
const changesOf = b => [...(store.log[b.id] || []), ...(rows.get(b.id) || [])].sort((x, y) => x.at - y.at);

// ---------------------------------------------------------------------------------- the hold
// When the position the testimony was approved (or sent) under began: the final approval; a waiting draft counts from the first approval, else from when it was sent.
const refTime = d => { const t = d.status === 'approved' ? d.second_approved_at || d.approved_at : d.status === 'second_review' ? d.approved_at || d.submitted_at : d.status === 'review' ? d.submitted_at : null; return t ? new Date(t).getTime() : d.status === 'approved' || d.status === 'review' || d.status === 'second_review' ? new Date(d.updated_at || d.created_at || 0).getTime() : null; };
const live = id => !!id && advocate(id)?.is_active !== false;
// who checks it: whoever leads the bill is its testimony writer (Nate, 14 Nov: the same rule as the Write step); else the one who sent it for approval, else whoever leads its issue or the admins
const writerOf = (d, b) => [...(S.assignments?.[b.id] || []), d.submitted_by, ...leadsFor(b)].find(live) || null;
export const checkId = (b, h) => `ck-${String(b.bill_number).replace(/\s/g, '')}-${h.id}`;
// null, or { d, h, from, to, cross, waiting, writer }: this testimony argues a position that is no longer HIPHI's
export function holdFor(b, d) {
  if (!b || !d || !['approved', 'review', 'second_review'].includes(d.status)) return null;
  const t0 = refTime(d); if (t0 == null) return null;
  const h = draftHearing(d); if (!h || h.status === 'cancelled' || new Date(h.scheduled_at).getTime() <= Date.now()) return null;   // the hearing passed: it ends by itself
  const ch = changesOf(b).filter(c => c.at > t0); if (!ch.length) return null;
  const from = ch[0].from, now = b.position || null, last = ch[ch.length - 1];
  if (from === now || (last.to || null) !== now) return null;   // the position went back, or the record is not this bill's present (a restart, a change made elsewhere)
  const kept = store.kept[d.id]; if (kept && kept >= last.at) return null;
  return { d, h, from, to: now, cross: side(from) !== side(now), waiting: d.status !== 'approved', writer: writerOf(d, b) };
}
onHold((h, b) => { const d = draftFor(h, b); return !!d && !!holdFor(b, d); });   // bill_words.js cannot import this file (a cycle), so the words of Calendar and Issues ask it through this hook
export const holdsOf = b => (S.drafts?.[b.id] || []).map(d => holdFor(b, d)).filter(Boolean);
const nameOf = id => id ? first(advocate(id)) : 'An admin';
const isMe = id => !!id && S.me?.id === id;

// The amber strip on the bill page, once for all its held testimony.
export function holdStrip(b) {
  const hs = holdsOf(b); if (!hs.length) return '';
  const n = hs.length, allA = hs.every(x => !x.waiting), allW = hs.every(x => x.waiting);
  const noun = allA ? (n === 1 ? 'approved testimony' : 'approved testimonies') : allW ? (n === 1 ? 'testimony waiting for approval' : 'testimonies waiting for approval') : (n === 1 ? 'testimony' : 'testimonies');
  const says = [...new Set(hs.map(x => label(x.from)))].join(' or ');
  const w = hs[0].writer, you = isMe(w);
  return `<div class="strip pos" id="bPosHold" role="note">${ic('triangle-alert')}<strong>${esc(`Position: ${label(b.position)}. ${n} ${noun} ${n === 1 ? 'says' : 'say'} ${says}.`)}</strong>`
    + `<span class="hl">${esc(`Filing is held until ${you ? 'you check' : `${nameOf(w)} checks`} the testimony.`)}</span>`
    + `<span class="hl">${esc(`${you ? 'You get' : `${nameOf(w)} gets`} a step to check it.`)}</span></div>`;
}

// The amber box at the top of the File testimony step while it is held.
export function holdBox(hd, b) {
  const w = hd.writer, you = isMe(w);
  return `<div class="strip pos" id="posHold" role="note">${ic('triangle-alert')}<strong>Position changed</strong>`
    + `<span class="hl">${esc(`The position changed to ${label(hd.to)} after this testimony was approved. It cannot be filed until it is checked.`)}</span>`
    + (you ? `<span class="hl pact">${btn('Check your testimony', { kind: 'filled', href: `#/do/${enc(checkId(b, hd.h))}`, id: 'chkGo' })}</span>`
      : `<span class="hl">${esc(`${nameOf(w)} is checking it. You will get the step File testimony again when it is approved.`)}</span>`)
    + '</div>';
}

// ---------------------------------------------------------------------------------- the writer's step (stepsFor adds these)
// at is the start of today so the step sorts first on Home (homeModel sorts by it); steps.js pastDue leaves this kind out, so it is never "past due" and its row says "Today"
const dayStart = () => new Date(`${new Date().toLocaleDateString('en-CA', { timeZone: 'Pacific/Honolulu' })}T00:00:00-10:00`).getTime();
export function checkSteps(me) {
  if (!me) return [];
  const out = [], ids = new Set([...Object.keys(store.log), ...rows.keys()]);
  for (const b of S.bills || []) {
    if (!ids.has(String(b.id)) && !ids.has(b.id)) continue;
    if (b.tracked === false) continue;
    for (const hd of holdsOf(b)) {
      if (hd.writer !== me.id) continue;
      out.push({ id: checkId(b, hd.h), kind: 'check', bill: b, hearing: hd.h, draft: hd.d, at: dayStart(), due: testimonyDue(hd.h), until: null, act: null, tone: 'neutral', late: false, issue: issueOf(b), name: billName(b), no: billNo(b),
        forWhom: '', sentBack: '', ask: null, verb: 'Check your testimony', mark: 'Today', hold: hd });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------- the step's page
const writtenTo = p => side(p) === 'support' ? 'to support the bill' : side(p) === 'oppose' ? 'to oppose the bill' : `for the position ${label(p)}`;
export function checkSheet(s, ctx) {
  const hd = holdFor(s.bill, s.draft) || s.hold, d = s.draft, was = hd.waiting ? 'Sent for approval' : 'Approved', now = label(hd.to);
  let h = '<div class="pn">' + band(s.issue, 'Check your testimony', s.name, s.no) + '<div class="pbody">';
  h += `<div class="strip calm">${ic('clock')}<strong>Check it today</strong><span class="hl">The Capitol’s deadline is ${esc(dayTime(s.due))}.</span><span class="hl">${esc(hearingLine(s.hearing))}</span></div>`;
  h += `<div class="stgrid"><div class="stmain"><h2 class="sh">What changed</h2>`;
  h += `<p class="lead">${esc(`${was} when HIPHI’s position was ${label(hd.from)}. It is now ${now}.`)}${hd.cross ? '' : ' The testimony still argues for the same side.'}</p>`;
  if (hd.cross) h += `<p class="lead">${esc(`It was written ${writtenTo(hd.from)}. ${side(hd.to) === 'oppose' ? 'HIPHI now opposes the bill' : side(hd.to) === 'support' ? 'HIPHI now supports the bill' : `HIPHI’s position is now ${now}`}, so it cannot be filed as written.`)}</p>`;
  h += `${approvedLine({ draft: d })}${letterRow({ bill: s.bill, draft: d }, ctx, { pdf: true, pos: false })}</div></div>`;
  h += `<div class="sfoot" id="ckFoot">${btn('Change the testimony', { kind: 'filled', id: 'chgBtn' })}${hd.cross ? '' : btn('Keep it as written', { kind: 'quiet', id: 'keepBtn' })}<span class="fnote">Changing it sends it back to writing, then to approval again.</span></div>`;
  return h + '<p class="errt" id="ckErr" role="alert" hidden></p></div></div>';
}

// "Change the testimony": back to writing (quiet: no one is asked to review it again until it is sent). A waiting draft is pulled back by its sender (the data layer's 'withdraw'); an APPROVED draft has no database
// action that takes it back (only 'unapprove', by its approver within ten minutes), so on the practice copy the draft is put back to writing here, and live it needs one (a migration that sets hiphi.quiet, rule 9).
async function sendBack(s, hd) {
  const d = (S.drafts[s.bill.id] || []).find(x => x.id === s.draft.id); if (!d) throw new Error('The testimony could not be found.');
  const was = { ...d }, note = `The position changed to ${label(hd.to)} after this was approved. Change the testimony to match it, then send it for approval again.`;
  if (d.status === 'approved') {
    if (!DEMO) throw new Error('An approved testimony cannot be sent back from here yet. Ask an admin to undo its approval.');
    Object.assign(d, { status: 'draft', review_note: note, approved_by: null, approved_at: null, second_approved_by: null, second_approved_at: null, first_for_bill: null });
  } else {
    await DB.transition(s.bill.id, d.id, 'withdraw');
    if (DEMO) d.review_note = note;
  }
  return was;
}
export function bindCheck(s, ctx) {
  bindLetterRow();
  const err = document.getElementById('ckErr'), fail = e => { err.textContent = (e && e.message) || 'It did not go. Try again.'; err.hidden = false; };
  const hd = holdFor(s.bill, s.draft) || s.hold;
  document.getElementById('chgBtn')?.addEventListener('click', async ev => {
    const b = ev.currentTarget; err.hidden = true; b.disabled = true;
    try {
      const was = await sendBack(s, hd);
      const to = `#/do/${enc(`t-${String(s.bill.bill_number).replace(/\s/g, '')}-${s.hearing.id}`)}`;   // its Write testimony (Resubmit) step
      location.hash = to;
      addEventListener('hashchange', () => toast('Sent back to writing.', { undo: async () => { const d = (S.drafts[s.bill.id] || []).find(x => x.id === was.id); if (d) Object.assign(d, was); ctx.rerender(); } }), { once: true });
    } catch (e) { b.disabled = false; fail(e); }
  });
  document.getElementById('keepBtn')?.addEventListener('click', () => {
    const at = Date.now(), prev = store.kept[s.draft.id]; store.kept[s.draft.id] = at; persist();
    location.hash = '#/';
    addEventListener('hashchange', () => toast('Kept as written.', { undo: () => { if (prev == null) delete store.kept[s.draft.id]; else store.kept[s.draft.id] = prev; persist(); ctx.rerender(); } }), { once: true });
  });
}
