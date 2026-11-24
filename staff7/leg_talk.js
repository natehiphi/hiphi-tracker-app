// Log a talk (R-398 piece 12, part 3): the form that opens in place at the top of a legislator's page. Words typed are kept for the tab if the person leaves (S-11) and the form is open again
// when they come back. Save adds a legislator_notes row through DB.addLegNote (in memory on the practice copy) and offers a 10-second Undo; practice also keeps the follow-up date.
//   talkHTML(l, draft) -> the form;  bindTalk(l, { me, done, close }) wires it;  TALK_DRAFTS holds what is typed
import { S, DB, DEMO } from '../staff6/data.js';
import { esc } from './parts.js';
import { dateWords } from './words.js';
import { ourBills, billLabel } from './leg_data.js';

export const TALK_DRAFTS = {};   // legislator id -> { body, bill, date, fu, kind }, kept for the tab
export const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Pacific/Honolulu' });
const fuOn = () => DEMO;   // the kind of talk is the same: its column is not applied either
const KIND_OPTS = [['call', 'Call'], ['meeting', 'Meeting'], ['email', 'Email'], ['passing', 'In passing']];   // the follow-up date is migration 206's column, not applied: hidden on the live app until it is

export function talkHTML(l, d = {}) {
  const bills = ourBills(l, S.me).all, date = d.date || today();
  return `<form class="lptalk" id="lpTalkForm" novalidate aria-label="Log a talk with ${esc(l.name)}">`
    + `<h2 class="lph">Log a talk with ${esc(l.name)}</h2>`
    + (fuOn() ? `<div class="lpf"><p class="lpkl" id="lpKindL"><b>Kind</b> <span class="lpmut">optional</span></p><div class="segs3 lpkind" role="group" aria-labelledby="lpKindL">${KIND_OPTS.map(([k, w]) => `<button class="seg" type="button" data-kind="${k}" aria-pressed="${d.kind === k}">${w}</button>`).join('')}</div></div>` : '')
    + `<div class="lpf"><label for="lpTalkBody"><b>What was said</b></label><textarea id="lpTalkBody" rows="4" aria-describedby="lpTalkHint">${esc(d.body || '')}</textarea><p class="hint" id="lpTalkHint">Write only what was said and their public role. Others on staff can read notes.</p></div>`
    + `<div class="lpf"><label for="lpTalkBill"><b>About a bill</b> <span class="lpmut">optional</span></label><select id="lpTalkBill"><option value="">No bill</option>${bills.map(b => { const t = billLabel(b); return `<option value="${esc(b.id)}"${d.bill === b.id ? ' selected' : ''}>${esc(t.no + ' ' + t.name)}</option>`; }).join('')}</select></div>`
    + `<div class="lpf"><label for="lpTalkDate"><b>When</b></label><div class="lprow"><input type="date" id="lpTalkDate" value="${esc(date)}" max="${esc(today())}"><span class="lpmut" id="lpTalkWhen">${esc(dateWords(date))}</span></div></div>`
    + (fuOn() ? `<div class="lpf" id="lpFuBox"><label for="lpTalkFu"><b>Follow up by</b> <span class="lpmut">optional</span></label><div class="lprow"><input type="date" id="lpTalkFu" value="${esc(d.fu || '')}" min="${esc(today())}"><span class="lpmut" id="lpTalkFuW">${d.fu ? esc(dateWords(d.fu)) : ''}</span></div><p class="hint">It shows at the top of their notes until you log your next talk with them.</p></div>` : '')
    + `<p class="errt" id="lpTalkErr" role="alert" hidden></p>`
    + `<div class="lpbtns"><button class="btn filled" type="submit" id="lpTalkSave">Save</button><button class="btn quiet" type="button" id="lpTalkCancel">Cancel</button></div></form>`;
}

export function bindTalk(l, { done, close }) {
  const $ = id => document.getElementById(id), f = $('lpTalkForm'); if (!f) return;
  const read = () => ({ body: $('lpTalkBody').value, bill: $('lpTalkBill').value, date: $('lpTalkDate').value, fu: $('lpTalkFu')?.value || '', kind: f.querySelector('[data-kind][aria-pressed="true"]')?.dataset.kind || '' });
  const keep = () => { const d = read(); $('lpTalkWhen').textContent = d.date ? dateWords(d.date) : ''; const w = $('lpTalkFuW'); if (w) w.textContent = d.fu ? dateWords(d.fu) : ''; TALK_DRAFTS[l.id] = d; };
  f.querySelectorAll('[data-kind]').forEach(b => b.addEventListener('click', () => { const on = b.getAttribute('aria-pressed') === 'true'; f.querySelectorAll('[data-kind]').forEach(x => x.setAttribute('aria-pressed', 'false')); b.setAttribute('aria-pressed', String(!on)); keep(); }));
  f.addEventListener('input', keep); f.addEventListener('change', keep);
  f.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); delete TALK_DRAFTS[l.id]; close(); } });
  $('lpTalkCancel').addEventListener('click', () => { delete TALK_DRAFTS[l.id]; close(); });
  f.addEventListener('submit', async e => {
    e.preventDefault(); const d = read(), err = $('lpTalkErr'); err.hidden = true;
    if (!d.body.trim()) { err.textContent = 'Write what was said first.'; err.hidden = false; $('lpTalkBody').focus(); return; }
    const sv = $('lpTalkSave'); sv.disabled = true;
    try {
      const row = await DB.addLegNote(l.id, d.bill || null, d.body.trim(), { metOn: d.date || null });
      if (DEMO) {   // practice: the row sits in memory; a day other than today is dated that day so Latest talk puts it where it belongs
        if (d.date && d.date !== today()) row.created_at = new Date(d.date + 'T12:00:00-10:00').toISOString();
        if (d.fu) row.follow_up_on = d.fu;
        if (d.kind) row.kind = d.kind;
      }
      delete TALK_DRAFTS[l.id];
      done(row, () => { S.demoNotes = (S.demoNotes || []).filter(n => n.id !== row.id); for (const k of Object.keys(S.legNotes || {})) S.legNotes[k] = S.legNotes[k].filter(n => n.id !== row.id); });
    } catch (x) { sv.disabled = false; err.textContent = (x && x.message) || 'It did not save. Try again.'; err.hidden = false; }
  });
}
