// The write step's page: Write testimony, and Resubmit when the letter was sent back. The letter stays in its Google Doc; this page makes it, opens it and sends it.
import { S, DB, DEMO } from '../staff6/data.js';
import { band, dueStrip, note, btn, esc, fileRow, toast } from './parts.js';
import { hearingLine, approverLine, cmteWords, posWords } from './steps.js';
import { ic } from './icons7.js';

// HIPHI's position is shown in the letter's heading as a fact, never as a control: a bill's position shows on the public site,
// and S-8 says no control on a tracker page changes what the public sees.
const DOCS = 'https://docs.google.com/';

// Where the Doc started, said truthfully from from_draft_id (testimony_drafts, migration 124): HIPHI's earlier testimony, else the template.
function startedFrom(d) {
  if (!d.from_draft_id) return 'Started from HIPHI’s template';
  const src = Object.values(S.drafts || {}).flat().find(x => x.id === d.from_draft_id);
  return src ? `Started from HIPHI’s ${cmteWords(src.committee)} testimony` : 'Started from HIPHI’s earlier testimony';
}

// "Your letter" / "The letter": its heading with HIPHI's position, then one file row. The data has no Doc edit time (updated_at moves with
// every status change), so no "Last edited". In the practice copy the Doc links are fake: the control is a button that opens nothing.
export function letterBlock(s, ctx, { label = 'Your letter', sub = true, hint = '' } = {}) {
  const d = s.draft, name = `Letter to ${cmteWords(s.hearing?.committee)}`, tp = (s.bill.talking_points || []).filter(Boolean);
  let row;
  if (!d) row = fileRow(name, ctx.asked?.has(s.hearing?.id) ? 'Being made. It takes a few minutes.' : 'The letter is not made yet.', '');
  else if (!String(d.doc_url || '').startsWith(DOCS)) row = fileRow(name, 'The letter’s link is missing.', '');
  else row = fileRow(name, sub ? startedFrom(d) : '', DEMO ? btn('Open the letter', { kind: 'quiet', id: 'openDoc' }) : `<a class="btn quiet" id="openDoc" href="${esc(d.doc_url)}" target="_blank" rel="noopener">Open the letter</a>`);
  return `<p class="lethead"><span class="lab" id="letl">${esc(label)}</span><span class="posnote"> · HIPHI’s position: ${esc(posWords(s.bill))}</span></p>${row}`
    + (d && hint ? `<p class="hint">${esc(hint)}</p>` : '')
    + (tp.length ? `<p class="tpl"><button class="btn text" type="button" id="tpBtn" aria-expanded="false" aria-controls="tpList">See the talking points</button></p><ul class="tplist" id="tpList" hidden>${tp.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : '');
}
export function bindLetter(s, ctx) {
  const open = document.getElementById('openDoc');
  if (open && DEMO) open.addEventListener('click', () => toast('In the practice copy the letter does not open.'));
  const tb = document.getElementById('tpBtn'), list = document.getElementById('tpList');
  if (tb) tb.addEventListener('click', () => { list.hidden = !list.hidden; tb.setAttribute('aria-expanded', String(!list.hidden)); });
}

export function writeSheet(s, ctx) {
  const rs = s.kind === 'resubmit', apr = approverLine(s.draft, s.hearing, ctx.me), docOK = String(s.draft?.doc_url || '').startsWith(DOCS), ready = !!s.draft, asked = !ready && ctx.asked.has(s.hearing.id);
  let h = '<div class="pn">' + band(s.issue, rs ? 'Resubmit testimony' : 'Write testimony', s.name, s.no);
  h += '<div class="pbody">' + dueStrip(s, { hearing: hearingLine(s.hearing) });
  if (rs) h += note('Sent back', s.sentBack, { flag: true, mark: `<span class="flagmark">${ic('undo-2')}</span>` });
  h += `<div class="stgrid"><div class="stmain">${letterBlock(s, ctx, { hint: 'It opens in Google Docs. Come back here to send it.' })}</div></div>`;
  if (!ready && !asked) h += `<div class="sfoot">${btn('Make the letter', { kind: 'filled', id: 'makeBtn' })}<span class="fnote">Makes a Google Doc from HIPHI’s template. You write it there.</span></div>`;
  else if (!ready) h += `<div class="sfoot">${btn('Send for approval', { kind: 'filled', id: 'sendBtn', disabled: true })}<span class="fnote">The letter is being made.</span></div>`;
  else if (!docOK) h += `<div class="sfoot">${btn(rs ? 'Resubmit' : 'Send for approval', { kind: 'filled', id: 'sendBtn', disabled: true })}<span class="fnote">The letter’s link is missing, so it cannot be sent yet.</span></div>`;
  else h += `<div class="sfoot">${btn(rs ? 'Resubmit' : 'Send for approval', { kind: 'filled', id: 'sendBtn' })}<span class="fnote">Write it in the Doc, then send it. ${esc(apr.main.charAt(0).toUpperCase() + apr.main.slice(1))} ${/\byou\b/i.test(apr.main) ? 'approve' : 'approves'} before it is filed.</span></div>`;
  return h + '<p class="errt" id="sendErr" role="alert" hidden></p></div></div>';
}

export function bindWrite(s, ctx) {
  bindLetter(s, ctx);
  const err = document.getElementById('sendErr'), fail = e => { err.textContent = (e && e.message) || 'It did not go. Try again.'; err.hidden = false; };
  const mk = document.getElementById('makeBtn');
  if (mk) mk.addEventListener('click', async () => {
    mk.disabled = true; mk.classList.add('is-loading'); mk.setAttribute('aria-busy', 'true'); mk.textContent = 'Making';
    try {
      await DB.draftNow(s.hearing);   // practice copy: a stand-in draft after a moment. Live: records request_draft and nudges the draft-now job; the Doc appears minutes later
      if ((S.drafts[s.bill.id] || []).some(x => x.hearing_id === s.hearing.id && x.status !== 'cancelled')) ctx.rerender('#sendBtn');
      else { ctx.asked.add(s.hearing.id); ctx.rerender('#sendBtn'); }
    } catch (e) { mk.disabled = false; mk.classList.remove('is-loading'); mk.removeAttribute('aria-busy'); mk.textContent = 'Make the letter'; fail(e); mk.focus(); }
  });
  const b = document.getElementById('sendBtn');
  if (b && !b.disabled) b.addEventListener('click', async () => {
    err.hidden = true; b.disabled = true; b.classList.add('is-loading'); b.setAttribute('aria-busy', 'true'); b.textContent = 'Sending';
    try { await ctx.send(s); }
    catch (e) { b.disabled = false; b.classList.remove('is-loading'); b.removeAttribute('aria-busy'); b.textContent = s.kind === 'resubmit' ? 'Resubmit' : 'Send for approval'; fail(e); b.focus(); }
  });
  // Live, an asked-for Doc is looked for every 30 seconds while this page is open
  if (!s.draft && ctx.asked.has(s.hearing.id)) ctx.poll(async () => { await DB.reloadDrafts(s.bill.id); if ((S.drafts[s.bill.id] || []).some(x => x.hearing_id === s.hearing.id && x.status !== 'cancelled')) ctx.rerender('#sendBtn'); });
}

// The data change: the draft goes to the approvers (practice copy: in this tab's memory only). Returns what Undo needs.
export async function sendStep(s) {
  const b = s.bill, d = (S.drafts[b.id] || []).find(x => x.hearing_id === s.hearing.id && x.status !== 'cancelled') || s.draft;
  if (!d) throw new Error('Make the letter first.');
  if (!String(d.doc_url || '').startsWith(DOCS)) throw new Error('The letter’s link is missing, so it cannot be sent.');
  const noteWas = d.review_note || null;
  await DB.transition(b.id, d.id, 'submit');
  return { billId: b.id, draftId: d.id, noteWas };
}
export async function undoSend(u) {
  await DB.transition(u.billId, u.draftId, 'withdraw');
  const d = (S.drafts[u.billId] || []).find(x => x.id === u.draftId); if (d) d.review_note = u.noteWas;   // practice copy: it goes back as it was, note and all
}
