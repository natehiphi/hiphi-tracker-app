// The file step's page: File testimony. The approved letter is in its Google Doc; this page gives the Capitol form's answers to copy, sends the person to the Capitol's page (the only exit to the Capitol in the whole app) and asks "Did you file it?" when they come back.
import { S, DB, DEMO, advocate, capitolUrl } from '../staff6/data.js';
import { draftHearing, codesOf } from '../staff6/model.js';
import { formChoice } from '../staff6/filing.js';
import { clearReminders } from '../staff6/steps.js';
import { POS_WORD } from '../staff6/ui.js';
import { band, dueStrip, btn, esc, fileRow, personMark, toast } from './parts.js';
import { hearingLine, cmteWords, posWords, dayTime, first } from './steps.js';

const HIPHI = 'Hawaiʻi Public Health Institute';
// The Capitol form's three positions (staff6/filing.js FORM_POS, the form's own words); a position it has no word for is not copied.
const FORM_POS = { strongly_support: 'Support', support: 'Support', support_amend: 'Support', strongly_oppose: 'Oppose', oppose: 'Oppose', neutral: 'Comments' };
const DOCS = 'https://docs.google.com/';

// The only address this app sends a person to outside itself: an https page on the Capitol's own site.
export function capitolOK(url) {
  try { const u = new URL(url); return u.protocol === 'https:' && (u.hostname === 'capitol.hawaii.gov' || u.hostname.endsWith('.capitol.hawaii.gov')); } catch { return false; }
}

// The answers the Capitol's form asks, the same set staff6/filing.js shows. Typed answers (organization, the name it is signed with, a coalition's) have Copy; choices on the form (position, how HIPHI testifies) say "Choose: ..." and have none.
export function formAnswers(s) {
  const b = s.bill, h = s.hearing || (s.draft && draftHearing(s.draft)), pos = FORM_POS[b.position] || '', ch = formChoice(h);
  const coals = (S.billCampaigns?.[b.id] || []).map(id => (S.campaigns || []).find(c => c.id === id)).filter(c => c && c.name !== 'General HIPHI' && c.slug !== 'general-hiphi');
  const out = [pos ? { label: 'Position', value: `Choose: ${pos}` } : { label: 'Position', value: POS_WORD[b.position] || 'Ask the bill’s owner' },
    { label: 'Organization', value: HIPHI, copy: true }, { label: 'Signed with', value: 'HIPHI', copy: true }];
  for (const c of coals) { const n = String(c.public_name || c.name || '').trim(); if (n) out.push({ label: coals.length > 1 ? `Or for ${c.name}` : 'Or for the coalition', value: n, copy: true, hint: 'Use this if you are filing for the coalition instead.' }); }
  out.push(ch.going ? { label: 'How we testify', value: 'Choose: In person', hint: `${ch.words.replace(/^In person: /, '')}. Speaking by video instead? Choose Remote.` }
    : { label: 'How we testify', value: `Choose: ${ch.words}`, hint: 'Someone speaking? Choose In person, or Remote by video.' });
  return out;
}
// The Doc's own PDF: only from a Doc id made of the characters an id has.
export function pdfUrl(url) { const m = /^https:\/\/docs\.google\.com\/document\/d\/([A-Za-z0-9_-]+)/.exec(String(url || '')); return m ? `https://docs.google.com/document/d/${m[1]}/export?format=pdf` : ''; }

// "The letter": the Doc, as one file row. In the practice copy its controls are buttons that open nothing. `pdf`: the file page's "Download the PDF" (the Capitol's form takes a file). Shared with the Did we file? page.
export function letterRow(s, ctx, { pdf = false, pos = true } = {}) {
  const d = s.draft, name = d && ['approved', 'filed'].includes(d.status) ? 'The approved letter' : 'The letter', dl = pdf ? pdfUrl(d?.doc_url) : '';
  let row;
  if (!d) row = fileRow(name, 'There is no letter on record for this hearing.', '');
  else if (!String(d.doc_url || '').startsWith(DOCS)) row = fileRow(name, 'The letter’s link is missing.', '');
  else {
    const kind = dl ? 'text' : 'quiet';
    const open = DEMO ? btn('Open the letter', { kind, id: 'openDoc' }) : `<a class="btn ${kind}" id="openDoc" href="${esc(d.doc_url)}" target="_blank" rel="noopener">Open the letter</a>`;
    const get = !dl ? '' : DEMO ? btn('Download the PDF', { kind: 'quiet', id: 'pdfBtn' }) : `<a class="btn quiet" id="pdfBtn" href="${esc(dl)}" target="_blank" rel="noopener">Download the PDF</a>`;
    row = fileRow(name, '', get + open);
  }
  return `<p class="lethead"><span class="lab" id="letl">The letter</span>${pos ? `<span class="posnote"> · HIPHI’s position: ${esc(posWords(s.bill))}</span>` : ''}</p>${row}`;
}
export function bindLetterRow() {
  const open = document.getElementById('openDoc'), pdf = document.getElementById('pdfBtn');
  if (open && DEMO) open.addEventListener('click', () => toast('In the practice copy the letter does not open.'));
  if (pdf && DEMO) pdf.addEventListener('click', () => toast('In the practice copy the PDF does not download.'));
}

// "Kris approved it Mon 9:10 AM." from the draft; the second look's approval is the later one.
export function approvedLine(s) {
  const d = s.draft; if (!d || !['approved', 'filed'].includes(d.status)) return '';
  const who = advocate(d.second_approved_by) || advocate(d.approved_by), at = d.second_approved_at || d.approved_at;
  return who ? `<p class="who2">${personMark(who.initials, { small: true })}<span><b>${esc(first(who))}</b> approved it${at ? ` ${esc(dayTime(at))}` : ''}.</span></p>` : '';
}

const foot = (s, ctx) => ctx.stage[s.id] === 2
  ? `<div class="sfoot" id="flFoot" role="group" aria-labelledby="fq"><p class="fq" id="fq">Did you file it?</p>${btn('Yes, filed', { kind: 'filled', id: 'yesBtn' })}${btn('Not yet', { kind: 'quiet', id: 'notYet' })}</div>`
  : `<div class="sfoot" id="flFoot">${btn('Submit on the Capitol site', { kind: 'filled', id: 'subBtn' })}<span class="fnote">Attach the PDF on the Capitol’s page, then come back here. ${btn('I already filed it', { kind: 'text', id: 'already' })}</span></div>`;

export function fileSheet(s, ctx) {
  const h0 = s.hearing || (s.draft && draftHearing(s.draft)), code = h0 ? codesOf(h0.committee).join('/') : '';
  let h = '<div class="pn">' + band(s.issue, 'File testimony', s.name, s.no);
  h += '<div class="pbody">' + dueStrip(s, { hearing: hearingLine(s.hearing) });
  h += `<div class="stgrid"><div class="stmain">${approvedLine(s)}${letterRow(s, ctx, { pdf: true, pos: false })}`
    + `<h2 class="sh">The Capitol’s form asks</h2>${code ? `<p class="hint">Log in, press Submit Testimony and pick the ${esc(code)} hearing.</p>` : ''}<div class="copyrows">${formAnswers(s).map(a => `<div class="copyrow"><div class="cq"><span>${esc(a.label)}</span><b>${esc(a.value)}</b>${a.hint ? `<span class="sub">${esc(a.hint)}</span>` : ''}</div>`
      + (a.copy ? btn('Copy', { kind: 'text', attrs: `data-copy="${esc(a.value)}" aria-label="Copy ${esc(a.label.toLowerCase())}: ${esc(a.value)}"` }) : '') + '</div>').join('')}</div></div></div>`;
  return h + `<div id="flSlot" class="fslot">${foot(s, ctx)}</div><p class="errt" id="flErr" role="alert" hidden></p></div></div>`;
}

// Copy puts the answer on the clipboard on the tap (what lets the browser allow it); if the browser refuses, the answer is shown to copy by hand.
export function bindCopy() {
  document.querySelectorAll('[data-copy]').forEach(c => c.addEventListener('click', () => {
    const text = c.dataset.copy, done = () => { c.textContent = 'Copied'; setTimeout(() => { if (c.isConnected) c.textContent = 'Copy'; }, 2000); }, hand = () => toast(`Copying is blocked in this browser. Select it instead: ${text}`);
    try { navigator.clipboard.writeText(text).then(done, hand); } catch { hand(); }
  }));
}

export function bindFile(s, ctx) {
  bindLetterRow(); bindCopy();
  const slot = document.getElementById('flSlot'), err = document.getElementById('flErr'), fail = e => { err.textContent = (e && e.message) || 'It did not go. Try again.'; err.hidden = false; };
  const wire = focus => {
    err.hidden = true;
    const sub = document.getElementById('subBtn'), already = document.getElementById('already'), yes = document.getElementById('yesBtn'), no = document.getElementById('notYet');
    if (sub) sub.addEventListener('click', () => {
      // The practice copy opens nothing. Live, one new tab on the Capitol's own site and nowhere else.
      if (!DEMO) { const url = capitolUrl(s.bill); if (!capitolOK(url)) return fail(new Error('The Capitol’s page address could not be built for this bill.')); window.open(url, '_blank', 'noopener'); }
      ctx.setStage(s.id, 2); slot.innerHTML = foot(s, ctx); wire('#yesBtn'); if (DEMO) toast('In the practice copy the Capitol’s page does not open.');
    });
    if (already) already.addEventListener('click', () => { ctx.setStage(s.id, 2); slot.innerHTML = foot(s, ctx); wire('#yesBtn'); });
    if (no) no.addEventListener('click', () => { ctx.setStage(s.id, 1); slot.innerHTML = foot(s, ctx); wire('#subBtn'); });
    if (yes) yes.addEventListener('click', async () => {
      err.hidden = true; yes.disabled = true; yes.classList.add('is-loading'); yes.setAttribute('aria-busy', 'true'); yes.textContent = 'Saving';
      try { await ctx.fileIt(s); }
      catch (e) { yes.disabled = false; yes.classList.remove('is-loading'); yes.removeAttribute('aria-busy'); yes.textContent = 'Yes, filed'; fail(e); yes.focus(); }
    });
    if (focus) document.querySelector(focus)?.focus();
  };
  wire();
}

// The data change: the approved draft is marked filed (the data layer's own transition, as staff6/filing.js markFiled does). Live this also queues a Slack message to the admins.
export async function fileStep(s) {
  const b = s.bill, d = (S.drafts[b.id] || []).find(x => x.id === s.draft?.id);
  if (!d) throw new Error('The letter could not be found.');
  await DB.transition(b.id, d.id, 'file');
  try { clearReminders(b, d); } catch { /* the dot stays until the next load */ }
  if ((S.drafts[b.id] || []).find(x => x.id === d.id)?.status !== 'filed') throw new Error('Nothing to do on it now.');   // live the row is replaced, so it is read again
  return { billId: b.id, draftId: d.id };
}
export const undoFile = u => DB.transition(u.billId, u.draftId, 'unfile');   // back to approved, as staff6/filing.js's Undo
