// The write step's page: Write testimony, and Resubmit when the letter was sent back, with its one filled button "Send for approval".
import { S, DB } from '../staff6/data.js';
import { cmteName } from '../staff6/model.js';
import { band, dueStrip, note, btn, esc } from './parts.js';
import { hearingLine, approversOf, orNames } from './steps.js';
import { ic } from './icons7.js';

const POS = ['Support', 'Oppose', 'Comments'];
const posOf = b => /oppose/.test(b.position || '') ? 'Oppose' : /support/.test(b.position || '') ? 'Support' : 'Comments';

// ---- where a letter starts. The practice data (and the live tables) keep a testimony draft as a Google Doc link and a status,
// never the letter's words, so no earlier letter can be put in the box: it starts from an outline made of the bill's own facts. ----
const lastName = n => { const w = String(n || '').replace(/\b(Jr|Sr|II|III|IV)\.?$/i, '').trim().split(/\s+/); return w[w.length - 1] || ''; };
function addressee(s) {
  const codes = String(s.hearing?.committee || '').split('/').map(c => c.trim()).filter(Boolean), c0 = S.committees?.[codes[0]];
  const chair = c0?.chair ? `Chair ${lastName(c0.chair)}` : 'Chair';
  const body = codes.length > 1 ? `Committees on ${codes.map(c => S.committees?.[c]?.name || c).join(' and ')}` : `${c0?.chamber === 'S' ? 'Senate' : 'House'} Committee on ${c0?.name || cmteName(codes[0])}`;
  return `Dear ${chair} and Members of the ${body}:`;
}
export function outline(s, pos) {
  const b = s.bill, tp = (b.talking_points || []).filter(Boolean), verb = pos === 'Oppose' ? 'opposes' : pos === 'Comments' ? 'offers comments on' : 'supports';
  const why = tp.length ? tp.join(' ') : '[Two or three sentences on why Hawaiʻi needs this.]';
  const ask = pos === 'Oppose' ? `We respectfully ask the committee to hold ${s.no}.` : pos === 'Comments' ? `We respectfully ask the committee to consider these comments on ${s.no}.` : `We respectfully ask the committee to pass ${s.no}.`;
  return `${addressee(s)}\n\nThe Hawaiʻi Public Health Institute ${verb} ${s.no} (${s.name}).\n\n${why}\n\n${ask} Mahalo for the opportunity to testify.\n\nHawaiʻi Public Health Institute`;
}
// HIPHI's last filed testimony on this bill, if any: said in one line, truthfully (its words are in a Google Doc this page cannot read).
function earlierFiled(s) {
  const f = (S.drafts?.[s.bill.id] || []).filter(d => d.status === 'filed' && d.id !== s.draft?.id && d.filed_at).sort((x, y) => String(y.filed_at).localeCompare(String(x.filed_at)))[0];
  return f ? `HIPHI filed testimony on this bill on ${new Date(f.filed_at).toLocaleDateString('en-US', { timeZone: 'Pacific/Honolulu', month: 'long', day: 'numeric' })} (${cmteName(f.committee)}). Its words are in a Google Doc this page cannot open yet.` : '';
}
function whereFrom(s, kept) {
  if (kept) return 'Your words, as you left them.';
  const tp = (s.bill.talking_points || []).length;
  return `${s.kind === 'resubmit' ? 'The letter that was sent back is in a Google Doc this page cannot open yet. ' : ''}Started from an outline${tp ? ' and this bill’s talking points' : ''}.`;
}

export function writeSheet(s, ctx) {
  const kept = ctx.letters[s.id], pos = kept?.pos || posOf(s.bill), text = kept ? kept.text : outline(s, pos), rs = s.kind === 'resubmit';
  if (!kept) ctx.letters[s.id] = { pos, text, made: text };   // remembered from the first draw, so Back and another row lose nothing
  const apr = approversOf(s.draft, s.hearing, ctx.me), tp = (s.bill.talking_points || []).filter(Boolean), ef = earlierFiled(s);
  let h = '<div class="pn">' + band(s.issue, rs ? 'Resubmit testimony' : 'Write testimony', s.name, s.no);
  h += '<div class="pbody">' + dueStrip(s, hearingLine(s.hearing));
  if (rs) h += note('Sent back', s.sentBack, { flag: true, mark: `<span class="flagmark">${ic('undo-2')}</span>` });
  h += `<div class="stgrid"><div class="stmain"><span class="lab" id="posl">Position</span><div class="chips" role="radiogroup" aria-labelledby="posl">`
    + POS.map(p => `<button class="chip" type="button" role="radio" aria-checked="${p === (ctx.letters[s.id].pos)}" data-pos="${p}">${ic('check')}${p}</button>`).join('') + '</div>';
  h += `<div class="lethead"><label class="lab" for="letter">Your letter</label><span class="qnote" id="from">${esc(whereFrom(s, !!kept))}`
    + (tp.length ? ` <span class="qlink"><button type="button" id="tpBtn" aria-expanded="false" aria-controls="tpPop">See the talking points</button><span class="pop" id="tpPop" hidden><b>Talking points</b><ul>${tp.map(t => `<li>${esc(t)}</li>`).join('')}</ul></span></span>` : '') + '</span></div>';
  h += `<textarea class="letter" id="letter" spellcheck="true">${esc(text)}</textarea></div>`;
  const desc = String(s.bill.status_text || '').trim();
  h += `<aside class="stside" aria-label="About this bill"><h3>The bill</h3><p>${esc(s.name)} <span class="no">${esc(s.no)}</span></p><h3>Last time</h3><p>${esc(ef || 'HIPHI has not filed testimony on this bill before.')}</p>${desc ? `<h3>Where it stands</h3><p>${esc(desc)}</p>` : ''}</aside></div>`;
  h += `<div class="sfoot">${btn(rs ? 'Resubmit' : 'Send for approval', { kind: 'filled', id: 'sendBtn' })}<span class="fnote">${esc(orNames(apr))} approves before it is filed.</span></div><p class="errt" id="sendErr" role="alert" hidden></p></div></div>`;
  return h;
}

export function bindWrite(s, ctx) {
  const L = ctx.letters[s.id], ta = document.getElementById('letter'), root = document.querySelector('.paper');
  const fit = () => { ta.style.height = 'auto'; ta.style.height = Math.max(256, ta.scrollHeight + 2) + 'px'; };
  fit(); ta.addEventListener('input', () => { L.text = ta.value; fit(); document.getElementById('from').firstChild.textContent = 'Your words, as you left them. '; });
  document.fonts?.ready.then(fit); window.addEventListener('resize', fit, { once: true });
  const chips = [...document.querySelectorAll('.chip')];
  const pick = c => {
    chips.forEach(x => { x.setAttribute('aria-checked', x === c); x.tabIndex = x === c ? 0 : -1; });
    const was = L.pos; L.pos = c.dataset.pos;
    if (ta.value === L.made && was !== L.pos) { L.made = outline(s, L.pos); ta.value = L.made; L.text = L.made; fit(); }   // an untouched letter follows the position; a changed one is never rewritten
  };
  chips.forEach((c, i) => {
    c.tabIndex = c.getAttribute('aria-checked') === 'true' ? 0 : -1;
    c.addEventListener('click', () => pick(c));
    c.addEventListener('keydown', e => { const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key]; if (d) { e.preventDefault(); const n = chips[(i + d + chips.length) % chips.length]; pick(n); n.focus(); } });
  });
  const tb = document.getElementById('tpBtn'), pop = document.getElementById('tpPop');
  if (tb) {
    const close = () => { pop.hidden = true; tb.setAttribute('aria-expanded', 'false'); };
    tb.addEventListener('click', e => { e.stopPropagation(); const o = pop.hidden; pop.hidden = !o; tb.setAttribute('aria-expanded', o); });
    pop.addEventListener('click', e => e.stopPropagation());
    root.addEventListener('click', close); tb.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  }
  const b = document.getElementById('sendBtn');
  b.addEventListener('click', async () => {
    const err = document.getElementById('sendErr'); err.hidden = true;
    b.classList.add('is-loading'); b.setAttribute('aria-busy', 'true'); b.textContent = 'Sending';
    try { await ctx.send(s); }
    catch (e) { b.classList.remove('is-loading'); b.removeAttribute('aria-busy'); b.textContent = s.kind === 'resubmit' ? 'Resubmit' : 'Send for approval'; err.textContent = (e && e.message) || 'It did not go. Your words are kept. Try again.'; err.hidden = false; }
  });
}

// The data change: the draft goes to the approvers (practice copy: in this tab's memory only). Returns what Undo needs.
export async function sendStep(s) {
  const b = s.bill, h = s.hearing;
  let d = (S.drafts[b.id] || []).find(x => x.hearing_id === h.id && x.status !== 'cancelled') || s.draft;
  if (!d) {   // a hearing is set and nobody has made its draft yet: make it, as "Make the draft now" does
    await DB.draftNow(h);
    d = (S.drafts[b.id] || []).find(x => x.hearing_id === h.id && x.status !== 'cancelled');
    if (!d) throw new Error('The draft could not be made yet. Your words are kept. Try again.');
  }
  const noteWas = d.review_note || null;
  await DB.transition(b.id, d.id, 'submit');
  return { billId: b.id, draftId: d.id, noteWas };
}
export async function undoSend(u) {
  await DB.transition(u.billId, u.draftId, 'withdraw');
  const d = (S.drafts[u.billId] || []).find(x => x.id === u.draftId); if (d) d.review_note = u.noteWas;   // practice copy: it goes back as it was, note and all
}
