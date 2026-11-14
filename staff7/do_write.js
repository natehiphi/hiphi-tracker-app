// The write step's page: Write testimony, and Resubmit when the letter was sent back. The letter stays in its Google Doc; this page opens it and sends it.
import { S, DB, DEMO } from '../staff6/data.js';
import { band, dueStrip, note, btn, esc, fileRow, posFact, toast } from './parts.js';
import { hearingLine, approversOf, orNames, cmteWords } from './steps.js';
import { ic } from './icons7.js';

// Position in words. Shown as a fact: a bill's position shows on the public site, and S-8 says no control on a tracker page changes it.
const posWords = b => /oppose/.test(b.position || '') ? 'Oppose' : /support/.test(b.position || '') ? 'Support' : 'Comments';

// Where the Doc started, said truthfully from from_draft_id (testimony_drafts, migration 124): HIPHI's earlier testimony, else the template.
function startedFrom(d) {
  if (!d) return '';
  if (!d.from_draft_id) return 'Started from HIPHI’s template';
  const src = Object.values(S.drafts || {}).flat().find(x => x.id === d.from_draft_id);
  return src ? `Started from HIPHI’s ${cmteWords(src.committee)} testimony` : 'Started from HIPHI’s earlier testimony';
}

// "Your letter" / "The letter": one file row. No Doc yet: say so, and offer to make it. The data has no Doc edit time (updated_at moves with every status change), so no "Last edited".
export function letterBlock(s, label = 'Your letter') {
  const d = s.draft, name = `${s.no} testimony`, tp = (s.bill.talking_points || []).filter(Boolean);
  const row = d
    ? fileRow(name, startedFrom(d), `<a class="btn quiet" id="openDoc" href="${esc(d.doc_url || '#')}" target="_blank" rel="noopener">Open the letter</a>`)
    : fileRow(name, 'The letter is not made yet.', btn('Make the letter', { kind: 'quiet', id: 'makeBtn' }));
  return `<span class="lab" id="letl">${esc(label)}</span>${row}`
    + (d ? '<p class="hint">It opens in Google Docs. Come back here to send it.</p>' : '')
    + (tp.length ? `<p class="tpl"><button class="btn text" type="button" id="tpBtn" aria-expanded="false" aria-controls="tpList">See the talking points</button></p><ul class="tplist" id="tpList" hidden>${tp.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : '');
}
export function bindLetter(s, ctx) {
  const open = document.getElementById('openDoc');
  if (open) open.addEventListener('click', e => { if (DEMO) { e.preventDefault(); toast('In the practice copy the letter does not open.'); } });
  const tb = document.getElementById('tpBtn'), list = document.getElementById('tpList');
  if (tb) tb.addEventListener('click', () => { list.hidden = !list.hidden; tb.setAttribute('aria-expanded', String(!list.hidden)); });
  const mk = document.getElementById('makeBtn');
  if (mk) mk.addEventListener('click', async () => {
    mk.classList.add('is-loading'); mk.setAttribute('aria-busy', 'true'); mk.textContent = 'Making';
    try {
      await DB.draftNow(s.hearing);   // practice copy: a stand-in draft after a moment. Live: asks the draft job (request_draft + the draft-now dispatch); the Doc appears minutes later
      const made = (S.drafts[s.bill.id] || []).some(x => x.hearing_id === s.hearing.id && x.status !== 'cancelled');
      if (made) ctx.rerender(); else { mk.classList.remove('is-loading'); mk.removeAttribute('aria-busy'); mk.textContent = 'Make the letter'; toast('Asked for. The letter takes a few minutes. Come back to this step.'); }
    } catch (e) { mk.classList.remove('is-loading'); mk.removeAttribute('aria-busy'); mk.textContent = 'Make the letter'; toast((e && e.message) || 'The letter could not be asked for. Try again.'); }
  });
}

export function writeSheet(s, ctx) {
  const rs = s.kind === 'resubmit', apr = approversOf(s.draft, s.hearing, ctx.me), ready = !!s.draft;
  let h = '<div class="pn">' + band(s.issue, rs ? 'Resubmit testimony' : 'Write testimony', s.name, s.no);
  h += '<div class="pbody">' + dueStrip(s, { hearing: hearingLine(s.hearing) });
  if (rs) h += note('Sent back', s.sentBack, { flag: true, mark: `<span class="flagmark">${ic('undo-2')}</span>` });
  h += `<div class="stgrid"><div class="stmain">${posFact(posWords(s.bill))}${letterBlock(s)}</div></div>`;
  h += `<div class="sfoot">${btn(rs ? 'Resubmit' : 'Send for approval', { kind: 'filled', id: 'sendBtn', disabled: !ready })}<span class="fnote">${ready ? `${esc(orNames(apr))} approves before it is filed.` : 'Make the letter first.'}</span></div><p class="errt" id="sendErr" role="alert" hidden></p></div></div>`;
  return h;
}

export function bindWrite(s, ctx) {
  bindLetter(s, ctx);
  const b = document.getElementById('sendBtn');
  b.addEventListener('click', async () => {
    const err = document.getElementById('sendErr'); err.hidden = true;
    b.classList.add('is-loading'); b.setAttribute('aria-busy', 'true'); b.textContent = 'Sending';
    try { await ctx.send(s); }
    catch (e) { b.classList.remove('is-loading'); b.removeAttribute('aria-busy'); b.textContent = s.kind === 'resubmit' ? 'Resubmit' : 'Send for approval'; err.textContent = (e && e.message) || 'It did not go. Try again.'; err.hidden = false; }
  });
}

// The data change: the draft goes to the approvers (practice copy: in this tab's memory only). Returns what Undo needs.
export async function sendStep(s) {
  const b = s.bill, d = (S.drafts[b.id] || []).find(x => x.hearing_id === s.hearing.id && x.status !== 'cancelled') || s.draft;
  if (!d) throw new Error('Make the letter first.');
  const noteWas = d.review_note || null;
  await DB.transition(b.id, d.id, 'submit');
  return { billId: b.id, draftId: d.id, noteWas };
}
export async function undoSend(u) {
  await DB.transition(u.billId, u.draftId, 'withdraw');
  const d = (S.drafts[u.billId] || []).find(x => x.id === u.draftId); if (d) d.review_note = u.noteWas;   // practice copy: it goes back as it was, note and all
}
