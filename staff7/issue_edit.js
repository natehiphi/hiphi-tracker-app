// The issue page's edits (R-398): "Change the lead", the issue's goal and its own talking points. Only the issue's lead or an admin sees the buttons; everyone else looks. Every save goes through
// DB.updateIssue (the data layer's own call, so the same code works live), shows the page's usual saved/failed message and, when it fails, keeps what was typed. What is open or typed lives in `eui`,
// so the minute's redraw (and the redraw after a save) keeps it.
import { S, DB, SESSION_YEAR, isLiveBill } from '../staff6/data.js';
import { esc, btn, toast } from './parts.js';
import { first, billName, billNo, posWords } from './steps.js';
import { redrawKeep, norm, matchWords } from './find.js';
import { eCig } from './issues.js';
import { isAlive, billsOfIssue } from './standing.js';

export const eui = { id: null, lead: null, goal: null, tp: null, bills: null };   // id: the issue the three belong to (issue.js clears them when another issue is drawn); bills: null (closed) or { q } (Change the bills is on, q the words typed); each: null (closed) or { text|sel, busy, err }
const $ = id => document.getElementById(id);
export const mayEditIssue = (issue, me) => !!me && (issue.owner_id === me.id || !!me.is_admin);
export const pointsOf = issue => (Array.isArray(issue.talking_points) ? issue.talking_points : []).map(x => String(x?.text ?? x ?? '').trim()).filter(Boolean);
const errP = (id, on, words) => `<p class="hint berr" id="${id}" role="alert"${on ? '' : ' hidden'}>${esc(words)}</p>`;
const FAIL = 'We could not save that. Try again.';

// ---------------------------------------------------------------------------------- the lead
export const leadButton = () => btn('Change the lead', { kind: 'text', id: 'iLeadGo', attrs: 'aria-expanded="false" aria-controls="iLeadF"' });
export function leadForm(issue, me) {
  const e = eui.lead, people = S.advocates.filter(a => a.is_active !== false || a.id === issue.owner_id).slice().sort((x, y) => (y.id === me?.id) - (x.id === me?.id) || first(x).localeCompare(first(y), 'en'));
  const opts = people.map(a => `<option value="${esc(a.id)}"${e.sel === a.id ? ' selected' : ''}>${esc(first(a))}${a.id === me?.id ? ' (you)' : ''}</option>`).join('');
  return `<form class="bedit" id="iLeadF" novalidate><div class="bef"><label class="fl" for="iLeadSel">Who leads this issue</label><select class="field bsel" id="iLeadSel">${opts}</select>`
    + '<p class="hint">On the real tracker the new lead is told by Slack or email. Only the lead or an admin can change it again.</p></div>'
    + `<div class="beact">${btn('Save', { kind: 'filled', id: 'iLeadSave', disabled: e.sel === issue.owner_id || e.busy, loading: !!e.busy }).replace('type="button"', 'type="submit"')}${btn('Cancel', { kind: 'text', id: 'iLeadCancel' })}</div>`
    + `${errP('iLeadErr', e.err, FAIL)}<p class="hint">Each bill keeps its own position and lead. Change those on the bill’s page.</p></form>`;
}

// ---------------------------------------------------------------------------------- the goal and the talking points
const teamOnly = '<span class="to">team only</span>';
export function goalCell(issue, can) {
  const e = eui.goal, g = String(issue.goal || '').trim();
  if (e) return `<form class="bedit" id="iGoalF" novalidate><div class="bef"><label class="fl" for="iGoalIn">The goal for this session. Only the team sees it.</label><textarea class="field" id="iGoalIn" rows="3" maxlength="1000">${esc(e.text)}</textarea></div>`
    + `<div class="beact">${btn('Save the goal', { kind: 'filled', id: 'iGoalSave', disabled: e.busy, loading: !!e.busy }).replace('type="button"', 'type="submit"')}${btn('Cancel', { kind: 'text', id: 'iGoalCancel' })}</div>${errP('iGoalErr', e.err, FAIL)}</form>`;
  return `${g ? `${esc(eCig(g))} ` : ''}${can ? btn(g ? 'Change' : 'Add a goal', { kind: 'text', id: 'iGoalGo' }) : g ? '' : '<span class="m">None written</span>'}${teamOnly}`;
}
// own points: listed; none: the caller says where a bill's points are; `fallback` is that HTML
export function pointsCell(issue, can, fallback) {
  const e = eui.tp, pts = pointsOf(issue);
  if (e) return `<form class="bedit" id="iTpF" novalidate><div class="bef"><label class="fl" for="iTpIn">Talking points: 3 to 5 short points, one on each line. Only the team sees them.</label><textarea class="field" id="iTpIn" rows="6">${esc(e.text)}</textarea></div>`
    + `<div class="beact">${btn('Save the points', { kind: 'filled', id: 'iTpSave', disabled: e.busy, loading: !!e.busy }).replace('type="button"', 'type="submit"')}${btn('Cancel', { kind: 'text', id: 'iTpCancel' })}</div>${errP('iTpErr', e.err, e.err === 'count' ? 'Write 3 to 5 points, one on each line, or none.' : FAIL)}</form>`;
  const go = can ? btn(pts.length ? 'Change' : 'Write the issue’s own', { kind: 'text', id: 'iTpGo' }) : '';
  return pts.length ? `<ul class="btalk shown">${pts.map(t => `<li>${esc(eCig(t))}</li>`).join('')}</ul>${go}${teamOnly}` : `${fallback || '<span class="m">None written</span>'}${fallback && go ? ' · ' : ''}${go}${teamOnly}`;
}

// ---------------------------------------------------------------------------------- saving
const clearErr = (e, id) => { if (e.err) { e.err = false; const p = $(id); if (p) p.hidden = true; } };   // typing or choosing again takes the old failure message away
const focusLater = id => setTimeout(() => $(id)?.focus(), 0);
// `prev` null: no Undo (a lead who hands the issue on cannot take it back: the database refuses, so the toast must not offer it)
async function save(key, issue, patch, prev, words, failFocus) {
  const e = eui[key]; if (!e || e.busy) return;
  e.busy = true; e.err = false; redrawKeep();
  try {
    await DB.updateIssue(issue.id, patch);
  } catch { e.busy = false; e.err = true; redrawKeep(); focusLater(failFocus); return; }   // the block stays open, the typed words stay in it
  if (eui[key] === e) eui[key] = null;   // the person may have moved to another issue while it saved
  redrawKeep();
  if (!prev) { toast(words); return; }
  toast(words, { undo: async () => { try { await DB.updateIssue(issue.id, prev); redrawKeep(); toast('Put back'); } catch { toast('We could not put that back.'); } } });
}

export function bindEdit(issue, me) {
  $('iLeadGo')?.addEventListener('click', () => { eui.lead = { sel: issue.owner_id || '', busy: false, err: false }; redrawKeep(); focusLater('iLeadSel'); });
  $('iGoalGo')?.addEventListener('click', () => { eui.goal = { text: String(issue.goal || ''), busy: false, err: false }; redrawKeep(); focusLater('iGoalIn'); });
  $('iTpGo')?.addEventListener('click', () => { eui.tp = { text: pointsOf(issue).join('\n'), busy: false, err: false }; redrawKeep(); focusLater('iTpIn'); });
  const close = (key, goId) => { eui[key] = null; redrawKeep(); focusLater(goId); };
  const lf = $('iLeadF');
  if (lf) {
    const e = eui.lead;
    lf.addEventListener('change', ev => { if (ev.target.id === 'iLeadSel') { e.sel = ev.target.value; clearErr(e, 'iLeadErr'); const s = $('iLeadSave'); if (s && !e.busy) s.disabled = e.sel === issue.owner_id; } });
    lf.addEventListener('submit', ev => { ev.preventDefault(); if (e.sel === issue.owner_id) return; const who = S.advocates.find(a => a.id === e.sel); save('lead', issue, { owner_id: e.sel }, null, `Lead changed to ${who ? first(who) : 'nobody'}.`, 'iLeadSave'); });
    lf.addEventListener('keydown', ev => { if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); close('lead', 'iLeadGo'); } });
    $('iLeadCancel').addEventListener('click', () => close('lead', 'iLeadGo'));
  }
  const gf = $('iGoalF');
  if (gf) {
    const e = eui.goal; $('iGoalIn').addEventListener('input', ev => { e.text = ev.target.value; clearErr(e, 'iGoalErr'); });
    gf.addEventListener('submit', ev => { ev.preventDefault(); const t = e.text.trim(); save('goal', issue, { goal: t || null }, { goal: issue.goal ?? null }, t ? 'Goal saved' : 'Goal cleared', 'iGoalSave'); });
    gf.addEventListener('keydown', ev => { if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); close('goal', 'iGoalGo'); } });
    $('iGoalCancel').addEventListener('click', () => close('goal', 'iGoalGo'));
  }
  const tf = $('iTpF');
  if (tf) {
    const e = eui.tp; $('iTpIn').addEventListener('input', ev => { e.text = ev.target.value; clearErr(e, 'iTpErr'); });
    tf.addEventListener('submit', ev => {
      ev.preventDefault(); const pts = e.text.split('\n').map(s => s.trim()).filter(Boolean);
      if (pts.length && (pts.length < 3 || pts.length > 5)) { e.err = 'count'; redrawKeep(); focusLater('iTpIn'); return; }
      save('tp', issue, { talking_points: pts.length ? pts : null, talking_points_edited_at: new Date().toISOString() }, { talking_points: issue.talking_points ?? null, talking_points_edited_at: issue.talking_points_edited_at ?? null }, pts.length ? 'Talking points saved' : 'Talking points cleared', 'iTpSave');
    });
    tf.addEventListener('keydown', ev => { if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); close('tp', 'iTpGo'); } });
    $('iTpCancel').addEventListener('click', () => close('tp', 'iTpGo'));
  }
}

// ---------------------------------------------------------------------------------- the issue's bills (R-398 piece 9, gap C)
// "Change the bills" turns on edit mode in the Bills table: a field to find a bill, "Put it on" for each find, "Take off" on each row, "Done" to finish. A bill may sit on MORE THAN ONE
// issue (DB.setBillIssue only adds or removes the one pair), so putting a bill that is on another issue ADDS it here; it does not move it. Anyone on staff may do this.
const sameJSON = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const snap = b => ({ owner: (S.assignments[b.id] || []).slice(), tp: b.talking_points ?? null, at: b.talking_points_edited_at ?? null });
// what the database does when a bill goes on an issue (a lead for a bill nobody leads, the issue's talking points for a bill with none) is not undone by taking the bill off again, so Undo writes the old
// values back. The lead always can be. The talking points of a bill that is on the public site are held for an admin when someone else changes them (data.js HELD_COLS), so for them the data layer
// cannot take the copy back; restore answers true then, and the toast says so instead of filing a change nobody asked for.
async function restore(b, s) {
  if ((S.assignments[b.id] || []).join() !== s.owner.join()) await DB.setOwner(b.id, s.owner[0] || null);
  if (sameJSON(b.talking_points, s.tp)) return false;
  if (!S.me?.is_admin && isLiveBill(b)) return true;
  await DB.updateBill(b.id, { talking_points: s.tp, talking_points_edited_at: s.at });
  return false;
}
const ISSUE_OF = b => (S.billIssues || []).filter(x => x.bill_id === b.id).map(x => (S.issues || []).find(i => i.id === x.issue_id)).filter(i => i && !i.archived_at);
// what the page must SAY after a put-on: who now leads the bill and that it uses the issue's points. '' when neither happened.
function extrasOf(b, s0, me) {
  const o = (S.assignments[b.id] || [])[0], lead = !s0.owner.length && o ? S.advocates.find(a => a.id === o) : null, pts = !sameJSON(b.talking_points, s0.tp) && !!(b.talking_points || []).length;
  const l = lead ? (me && lead.id === me.id ? 'You now lead it' : `${first(lead)} now leads it`) : '';
  return l && pts ? `${l}, and it uses the issue’s talking points.` : l ? `${l}.` : pts ? 'It uses the issue’s talking points.' : '';
}
// style 'issue' (the issue page): "Put HB 797 on X." / "Took HB 1563 off X."; style 'bill' (the bill's Issues page): "HB 1005 is on X." / "HB 1005 is off X."
// `after`: what to redraw (default the page); resolves true when it saved
export async function moveBill(issue, b, on, { style = 'issue', me = null, after = redrawKeep } = {}) {
  const s0 = snap(b), wasAlive = isAlive(b), nm = eCig(issue.name), no = billNo(b);
  try { await DB.setBillIssue(b.id, issue.id, on); } catch { toast(on ? 'We could not put that bill on the issue. Try again.' : 'We could not take that bill off the issue. Try again.'); return false; }
  const extra = on ? extrasOf(b, s0, me) : '', none = !on && wasAlive && !billsOfIssue(issue).some(isAlive);
  const words = style === 'bill' ? `${no} is ${on ? 'on' : 'off'} ${nm}.` : on ? `Put ${no} on ${nm}.` : `Took ${no} off ${nm}.`;
  const msg = words + (extra ? ` ${extra}` : '') + (none ? ' It has no live bills now.' : '');
  moveBill.note = extra ? `${no} is on ${nm}. ${extra}` : '';
  after();
  toast(msg, { ms: extra || none ? 10000 : 6000, undo: async () => {
    try { await DB.setBillIssue(b.id, issue.id, !on); const kept = await restore(b, s0); moveBill.note = ''; after(); toast(kept ? `Put back. ${no} keeps the talking points it copied; change them on the bill’s page.` : 'Put back', kept ? { ms: 9000 } : {}); } catch { toast('We could not put that back.'); }
  } });
  return true;
}
moveBill.note = '';

const inSession = b => b.tracked !== false && (!b.session_year || +b.session_year === +SESSION_YEAR);
const compact = s => norm(s).replace(/ /g, '');
// bills that match what was typed (a number, or any words of the name), not already on this issue; an exact number first
function findBills(issue, q) {
  const ws = matchWords(q); if (!ws.length) return null;
  const on = new Set((S.billIssues || []).filter(x => x.issue_id === issue.id).map(x => x.bill_id)), cq = compact(q);
  return (S.bills || []).filter(b => inSession(b) && !on.has(b.id)).map(b => {
    const no = compact(b.bill_number), hay = ` ${norm(`${b.bill_number} ${billName(b)} ${b.title || ''} ${b.nickname || ''}`)} ${no} ${String(b.bill_number).replace(/\D/g, '')}`;
    return { b, ok: ws.every(alts => alts.some(a => hay.includes(' ' + a))), t: no === cq || String(b.bill_number).replace(/\D/g, '') === cq ? 0 : 1 };
  }).filter(x => x.ok).sort((x, y) => x.t - y.t || String(x.b.bill_number).localeCompare(String(y.b.bill_number), 'en', { numeric: true })).slice(0, 6).map(x => x.b);
}
function resultsHTML(issue, q) {
  const hits = findBills(issue, q); if (!hits) return '';
  if (!hits.length) return '<p class="hint">No bill matches that, or it is already on this issue.</p>';
  return '<ul class="bpres">' + hits.map(b => {
    const on = ISSUE_OF(b).map(i => eCig(i.name));
    return `<li><div class="bpt"><span class="bpn">${esc(billName(b))}</span><span class="bpm">${esc(billNo(b))} · ${b.position ? `Our position: ${esc(posWords(b))}` : 'No position yet'}</span><span class="bpm">${on.length ? `On: ${esc(on.join(', '))}` : 'On no issue yet'}</span></div>${btn('Put it on', { kind: 'quiet', attrs: `data-put="${esc(b.id)}" aria-label="Put ${esc(billNo(b))} on this issue"` })}</li>`;
  }).join('') + '</ul>';
}
// the head of the Bills table: the heading with its one button, and, in edit mode, the find field
export function billsHead(issue) {
  const on = !!eui.bills;
  return `<div class="bhead"><h2 class="sh" id="tBillsH">Bills</h2>${on ? btn('Done', { kind: 'filled', id: 'iBillsDone' }) : btn('Change the bills', { kind: 'quiet', id: 'iBillsGo', attrs: 'aria-expanded="false"' })}</div>`
    + (on ? `<div class="bput" id="iBillsEdit"><label class="fl" for="iPutIn">Put a bill on this issue: number or words</label><input class="field" id="iPutIn" type="text" autocomplete="off" spellcheck="false" value="${esc(eui.bills.q)}"><div id="iPutRes" aria-live="polite">${resultsHTML(issue, eui.bills.q)}</div></div>` : '');
}
export const takeOffCell = b => eui.bills ? `<td class="tx">${btn('Take off', { kind: 'quiet', attrs: `data-off="${esc(b.id)}" aria-label="Take ${esc(billNo(b))} off this issue"` })}</td>` : '';
export const takeOffCol = () => eui.bills ? '<col class="cx">' : '';
export const takeOffHead = () => eui.bills ? '<th scope="col" class="cxh"><span class="sr">Take off</span></th>' : '';
const wide = () => matchMedia('(min-width: 900px)').matches;
function closeBills() { eui.bills = null; redrawKeep(); focusLater('iBillsGo'); }
// Escape closes edit mode, from the field or from the page (the frame's own Escape would close the whole page)
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape' || e.defaultPrevented || e.isComposing || !eui.bills || !$('iBillsDone')) return;
  e.preventDefault(); e.stopPropagation(); closeBills();
});
export function bindBills(issue, me) {
  $('iBillsGo')?.addEventListener('click', () => { eui.bills = { q: '' }; redrawKeep(); focusLater('iPutIn'); });
  $('iBillsDone')?.addEventListener('click', closeBills);
  const inp = $('iPutIn');
  if (inp) inp.addEventListener('input', ev => { eui.bills.q = ev.target.value; $('iPutRes').innerHTML = resultsHTML(issue, eui.bills.q); });
  $('iPutRes')?.addEventListener('click', async ev => {
    const bt = ev.target.closest('[data-put]'); if (!bt || bt.disabled) return;
    const b = (S.bills || []).find(x => x.id === bt.dataset.put); if (!b) return;
    bt.disabled = true;
    const done = await moveBill(issue, b, true, { me });
    if (done) { eui.bills.q = ''; const f = $('iPutIn'); if (f) f.value = ''; const r = $('iPutRes'); if (r) r.innerHTML = ''; if (wide()) focusLater('iPutIn'); } else bt.disabled = false;
  });
  document.querySelectorAll('#tBills [data-off], #tDead [data-off]').forEach(bt => bt.addEventListener('click', async () => {
    const b = (S.bills || []).find(x => x.id === bt.dataset.off); if (!b || bt.disabled) return;
    bt.disabled = true;
    if (!(await moveBill(issue, b, false, { me }))) bt.disabled = false; else focusLater('iBillsDone');
  }));
}
