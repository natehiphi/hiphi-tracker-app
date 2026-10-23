// Staff v6 (R-336 V25, spec section 6): the filing card. In v5 filing was "File at the Capitol" (a bare link to the
// bill) and a Mark filed sheet; the Capitol form's answers lived only in Help, and Kevin's ready-to-file draft was folded
// under "+2 on this bill" (assessment X22, journey "file": 4 clicks and a trip to Help). Here every filing step is on one
// card, in the order a newcomer files:
//   1. the PDF (the approved Doc, exported as a PDF),
//   2. the Capitol page for this hearing (the bill's page, where Submit Testimony picks the hearing),
//   3. the form's answers, each with Copy: position, organization, the name it is signed with, and the form's choice of
//      how HIPHI testifies, filled from who is going ("In person: Kris is going", else "Written testimony only"; Remote is
//      named for whoever speaks by video, since nothing records that) with who is going and I'm going right under it, and
//      the watch link when the hearing has one,
//   4. Mark filed, with the Capitol's confirmation link if there is one. In the open item Mark filed stays in reach at the
//      foot of the screen (the panel's on a laptop, above the tab bar on a phone) while steps 1 to 3 scroll, as the sheet's
//      foot does (spec 3.2).
// The name it is signed with is HIPHI. A coalition's exact sign-off name is stored nowhere (campaigns.public_name is a topic
// label, "General Public Health" is HIPHI's own catch-all group), so the card never offers one to copy: a bill in a
// coalition says who to ask for it (fresh-eyes review 23 Oct, C-15).
// Step 2 names the hearing by its code too ("HHS/CPN"), small beside the words: the Capitol's hearing picker lists
// committees by code (spec 5: codes beside the words where the Capitol uses them).
// The same steps are a sheet (the row's File and the card's Mark filed anywhere in the app: setStepHook('file')) and the
// open item on Testimony › Ready to file (filingSteps, inline). From Today it is 2 taps: File, then Mark filed (P3 kept;
// target: 0 clicks to find, at most 3 steps in the app).
// After the sitting has started an unfiled draft is Missed (said in neutral, never red, addendum 4): the row's "Did we
// file?" offers "Yes, mark filed (late)", "No, we didn't file" (recorded on the bill, steps.js nofile) and "How did it go?";
// the card's own "Yes, mark filed (late)" asks only for the link. Undo on every step (P2).
import { S, DB, esc, capitolUrl, hooks } from './data.js';
import { draftHearing, streamOf, attendees, billRoute, whenAt, codesOf } from './model.js';
import { icon, btn, toast, openSheet, closeSheet, field, POS_WORD, ownerOf } from './ui.js';
import { setStepHook, finish, sayWords, committeeName, orWords, dayWords, timeWords, billStep, statusTile, shownStatus, firstWords } from './steps.js';

const HIPHI = 'Hawaiʻi Public Health Institute';
// The Capitol form's three positions (Help, How to file: "Support, Oppose or Comments").
const FORM_POS = { strongly_support: 'Support', support: 'Support', support_amend: 'Support', strongly_oppose: 'Oppose', oppose: 'Oppose', neutral: 'Comments' };
// A Google Doc's own PDF: the export address of the same Doc (Help's step 1, "File, Download, PDF", in one tap).
export const pdfUrl = url => { const m = /docs\.google\.com\/document\/d\/([^/?#]+)/.exec(String(url || '')); return m ? `https://docs.google.com/document/d/${m[1]}/export?format=pdf` : ''; };
// The bill's coalitions, less HIPHI's own catch-all group (General HIPHI), which is not a coalition anyone signs for.
const coalitionsOf = b => (S.billCampaigns?.[b.id] || []).map(id => (S.campaigns || []).find(c => c.id === id))
  .filter(c => c && c.name !== 'General HIPHI' && c.slug !== 'general-hiphi');
// Who knows the coalition's exact sign-off name: the bill's owner, else the coalition's lead (never the viewer).
function signAsk(b, coals) {
  const me = S.me?.id, own = ownerOf(b);
  if (own && own.id !== me) return `Ask ${firstWords(own.id)} (the bill’s owner) for its exact name.`;
  const lead = coals.map(c => c.owner_id).find(id => id && id !== me);
  return lead ? `Ask ${firstWords(lead)} (the coalition’s lead) for its exact name.` : 'Use the exact name the coalition signs its letters with.';
}
const sittingRows = h => (S.hearings || []).filter(x => x.committee === h.committee && x.scheduled_at === h.scheduled_at);
const goers = h => { const seen = new Set(); return h ? sittingRows(h).flatMap(r => attendees(r)).filter(a => !seen.has(a.id) && seen.add(a.id)).map(a => a.id) : []; };
// The form's choice, from who is going (V25 weak point: "written only" would steer Kris and Lauren wrong).
export function formChoice(h) {
  const ids = goers(h); if (!ids.length) return { words: 'Written testimony only', going: false };
  const who = orWords(ids, S.me, { and: true });
  return { words: `In person: ${who} ${ids.length > 1 || ids.includes(S.me?.id) ? 'are' : 'is'} going`, going: true };
}
// "the HHS/CPN hearing (Senate Health and Human Services, and Commerce), Fri 3/20, 9:30 AM": the code as the Capitol's
// picker lists it, small, then the words and the time. Escaped HTML.
function hearingPick(h) {
  if (!h) return 'its hearing';
  const code = codesOf(h.committee).join('/'), name = committeeName(h.committee);
  return `the <span class="v6-code tf-code">${esc(code || h.committee)}</span> hearing${name && name !== code ? ` (${esc(name)})` : ''}, ${esc(dayWords(h.scheduled_at))}, ${esc(timeWords(h.scheduled_at))}`;
}
const copyBtn = (text, what) => btn('Copy', { kind: 'secondary', sm: true, icon: 'copy', attrs: { 'data-fcopy': text, 'aria-label': `Copy ${what}: ${text}` } });
const answer = (label, value, copy = '', cls = '', tail = '') => `<div class="tf-ans${cls ? ' ' + cls : ''}"><dt>${esc(label)}</dt><dd><span class="tf-val">${value}</span>${copy}${tail}</dd></div>`;

// Steps 1 to 4. `inline`: the open item's card, whose Mark filed is the card's own button in a bar that stays at the foot
// of the screen while the steps scroll (filled where it is the screen's one filled button); a sheet puts Mark filed in its
// foot. `going`: the step card's "Going: …" line with its I'm going toggle (escaped HTML), moved here beside "How we
// testify", which it decides.
export function filingSteps(b, d, { inline = false, primary = true, going = '' } = {}) {
  const h = draftHearing(d), pdf = pdfUrl(d.doc_url), stream = h ? streamOf(h) : null, choice = formChoice(h);
  const pos = FORM_POS[b.position] || '', coals = coalitionsOf(b), id = `tf-${esc(d.id)}${inline ? '-i' : ''}`;
  const one = `<li class="tf-step"><span class="tf-n" aria-hidden="true">1</span><div class="tf-body"><p class="tf-h">Save the approved testimony as a PDF</p>
      <div class="tf-acts">${pdf ? btn('Download the PDF', { kind: 'secondary', icon: 'download', href: pdf, target: '_blank' }) : ''}${d.doc_url ? btn('Open Doc', { kind: 'text', sm: true, icon: 'file-text', iconEnd: 'external-link', href: d.doc_url, target: '_blank' }) : ''}</div>
      ${d.doc_url ? (pdf ? '' : '<p class="tf-help">In the Doc: File, Download, PDF.</p>') : `<p class="tf-help">The Doc’s link is missing. <a href="${esc(billRoute(b))}">Open the bill</a> to find the draft.</p>`}</div></li>`;
  const two = `<li class="tf-step"><span class="tf-n" aria-hidden="true">2</span><div class="tf-body"><p class="tf-h">Open the bill on the Capitol website</p>
      <div class="tf-acts">${btn('Open the Capitol page', { kind: 'secondary', iconEnd: 'external-link', href: capitolUrl(b), target: '_blank' })}</div>
      <p class="tf-help">Log in, press Submit Testimony and pick ${hearingPick(h)}.</p></div></li>`;
  const three = `<li class="tf-step"><span class="tf-n" aria-hidden="true">3</span><div class="tf-body"><p class="tf-h">Fill in the form</p>
      <dl class="tf-answers">
        ${answer('Position', pos ? esc(pos) : esc(POS_WORD[b.position] || 'Ask the bill’s owner'), pos ? copyBtn(pos, 'the position') : '')}
        ${answer('Organization', esc(HIPHI), copyBtn(HIPHI, 'the organization'))}
        ${answer('Signed with', `HIPHI${coals.length ? `<span class="tf-sub">Signing for a coalition? ${esc(signAsk(b, coals))}</span>` : ''}`, copyBtn('HIPHI', 'the name it is signed with'), 'tf-signed')}
        ${answer('How we testify', `${esc(choice.words)}<span class="tf-sub">${choice.going ? 'Speaking by video instead? Choose Remote.' : 'Someone speaking? Choose In person, or Remote by video.'}</span>`, '', 'tf-how', going ? `<div class="tf-going">${going}</div>` : '')}
        ${stream ? answer('Watch', `<a href="${esc(stream.url)}" target="_blank" rel="noopener">${icon('video')}<span>${esc(stream.label)}</span></a>`) : ''}
      </dl>
      <p class="tf-help">Upload the PDF and submit. A green box means it went in.</p></div></li>`;
  const four = `<li class="tf-step"><span class="tf-n" aria-hidden="true">4</span><div class="tf-body"><p class="tf-h">Mark it filed here</p>
      ${field(`${id}-url`, 'Capitol confirmation link (optional)', `<input id="${id}-url" type="url" inputmode="url" autocomplete="off" placeholder="https://" data-furl>`)}
      <p class="err" id="${id}-e" role="alert" hidden>That does not look like a web address. It starts with https://</p></div></li>`;
  const steps = `<ol class="tf-steps" aria-label="Filing steps">${one}${two}${three}${four}</ol>`;
  if (!inline) return steps;
  return `<div class="tf-wrap">${steps}<div class="tf-bar">${btn('Mark filed', { kind: primary ? 'primary' : 'secondary', icon: 'clipboard-check', attrs: { 'data-fgo': '1', 'data-v6b': b.id, 'data-v6d': d.id } })}</div></div>`;
}

// After the sitting started with nothing marked filed: the calm answers, all the same weight (addendum 4: noted, never
// red), for the sheet and the open item alike. Only approved testimony can be marked filed (the server refuses the rest),
// so a draft that never reached approval asks whether it went in anyway, and a yes is said on the bill.
export function missedChoices(b, d) {
  const a = { 'data-v6b': b.id, 'data-v6d': d.id }, talk = `${billRoute(b, 'activity')}?reply=1`;
  if (d.status !== 'approved') return `<p class="tf-q">It was never approved, so it can’t be marked filed here. Did it go in anyway?</p>
    <div class="tf-choices">${btn('No, it didn’t go in', { kind: 'secondary', attrs: { ...a, 'data-fnofile': '1' } })}
    ${btn('Yes: say so on the bill', { kind: 'secondary', icon: 'message-square', href: talk })}</div>`;
  return `<div class="tf-choices">${btn('Yes, mark filed (late)', { kind: 'secondary', icon: 'clipboard-check', attrs: { ...a, 'data-v6act': 'filed', 'data-v6late': '1' } })}
    ${btn('No, we didn’t file', { kind: 'secondary', attrs: { ...a, 'data-fnofile': '1' } })}
    ${btn('How did it go?', { kind: 'text', icon: 'message-square', href: talk })}</div>`;
}

// Mark filed, from the sheet or the inline card: the link is checked as v5's sheet did, then the same DB step, the calm
// finish and the Undo toast that says it is done (P2).
async function markFiled(b, d, root, el, after) {
  const inp = root.querySelector('[data-furl]'), er = root.querySelector('.err[role="alert"]'), url = (inp?.value || '').trim();
  if (url && !/^https?:\/\/[^\s/$.?#][^\s]*\.[^\s]{2,}$/i.test(url)) { if (er) er.hidden = false; inp.setAttribute('aria-invalid', 'true'); inp.focus(); return; }
  if (el) { el.setAttribute('aria-busy', 'true'); el.disabled = true; }
  try {
    await DB.transition(b.id, d.id, 'file', null, url || null);
    const redraw = after || (() => hooks.render());
    if (el?.closest('dialog')) await closeSheet({ silent: true });
    else await finish(el);
    redraw();
    toast(`Filed. ${sayWords(b)} is done for ${committeeName(d.committee) || d.committee}.`, { ok: true,
      undo: async () => { await DB.transition(b.id, d.id, 'unfile'); toast('Filing undone. It is approved and ready to file again.'); redraw(); } });
  } catch (e) { toast(e, { err: true }); if (el?.isConnected) { el.removeAttribute('aria-busy'); el.disabled = false; } }
}

// The sheet: the row's File, the card's Mark filed. Its foot holds the one filled button, Mark filed.
export function openFiling(b, d, { late = false, after, el } = {}) {
  if (late) return el?.textContent?.includes('Did we file') ? didWeFile(b, d, { after }) : lateSheet(b, d, { after });
  const s = billStep(b, { d }), st = s ? shownStatus(s) : null, tile = st && ['late', 'overdue'].includes(st.tone) ? st : s?.act?.words ? { tone: 'neutral', icon: 'clock', words: s.act.words } : null;
  openSheet({ title: `File the ${esc(sayWords(b))} testimony`, size: 'auto',
    body: `<div class="tf-sheet">${tile ? `<p class="tf-when">${statusTile(tile)}</p>` : ''}${filingSteps(b, d)}</div>`,
    foot: btn('Mark filed', { kind: 'primary', icon: 'clipboard-check', attrs: { 'data-fsheet': '1' } }),
    wire: dlg => {
      const go = dlg.querySelector('[data-fsheet]'), inp = dlg.querySelector('[data-furl]');
      inp?.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); go.click(); } });
      inp?.addEventListener('input', () => { inp.removeAttribute('aria-invalid'); const er = dlg.querySelector('.err[role="alert"]'); if (er) er.hidden = true; });
      go.onclick = () => markFiled(b, d, dlg, go, after);
    } });
}
// "Yes, mark filed (late)" on the closing card: the person already said yes, so only the link and Mark filed.
function lateSheet(b, d, { after } = {}) {
  const id = `tf-${esc(d.id)}-late`;
  openSheet({ title: `Filed the ${esc(sayWords(b))} testimony (late)?`, size: 'auto',
    body: `${field(`${id}-url`, 'Capitol confirmation link (optional)', `<input id="${id}-url" type="url" inputmode="url" autocomplete="off" placeholder="https://" data-furl>`, 'Paste the link from the Capitol’s confirmation, if you have it.')}<p class="err" id="${id}-e" role="alert" hidden>That does not look like a web address. It starts with https://</p>`,
    foot: btn('Mark filed', { kind: 'primary', icon: 'clipboard-check', attrs: { 'data-fsheet': '1' } }),
    wire: dlg => { const go = dlg.querySelector('[data-fsheet]'); go.onclick = () => markFiled(b, d, dlg, go, after); } });
}
// The row's "Did we file?" after the sitting started: three calm answers, none of them red (V25, addendum 4).
function didWeFile(b, d, { after } = {}) {
  const h = draftHearing(d);
  openSheet({ title: `Did we file the ${esc(sayWords(b))} testimony?`, size: 'auto',
    body: `<p class="tf-q">${esc(h ? `The ${committeeName(h.committee) || h.committee} hearing started ${whenAt(h.scheduled_at)}.` : 'Its hearing has started.')} Either answer is fine: it is noted for the team, with nobody blamed.</p>
      ${missedChoices(b, d)}`,
    wire: dlg => { dlg.querySelectorAll('a[href^="#/"]').forEach(x => x.addEventListener('click', () => closeSheet({ silent: true }))); } });
  void after;
}

// "No, we didn't file": steps.js's nofile step (the same line on the bill's timeline, which steps.js notFiled reads, and the
// same Undo), with the toast said for where it was answered: on Testimony the row stays, under The record, so "It leaves
// your list" (steps.js, right for Today) would not be true there. Shared change asked: steps.js to take the toast's words.
async function noFile(b, d, el) {
  const h = draftHearing(d), title = `Testimony not filed for the ${committeeName(d.committee) || d.committee} hearing${h ? ' ' + dayWords(h.scheduled_at) : ''}`;
  const redraw = HOOK_AFTER && S.route?.name === 'testimony' ? HOOK_AFTER : () => hooks.render();
  el.setAttribute('aria-busy', 'true'); el.disabled = true;
  try {
    if (el.closest('dialog')) await closeSheet({ silent: true });
    await DB.addActivity(b.id, 'testimony', title); (S.v6NoFile ??= new Set()).add(String(d.id));
    if (el.isConnected) await finish(el);
    redraw();
    toast(`Noted on the bill: not filed. ${S.route?.name === 'testimony' ? 'It stays on Missed, as the record.' : 'It leaves your list.'}`, { undo: async () => { S.v6NoFile.delete(String(d.id)); redraw(); } });
  } catch (err) { toast(err, { err: true }); if (el.isConnected) { el.removeAttribute('aria-busy'); el.disabled = false; } }
}

// One listener for the whole app, like steps.js: Copy writes the answer on the tap (that is what lets the browser write
// the clipboard), else shows it to copy by hand; the inline card's Mark filed finds its bill and draft.
if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('click', e => {
  const c = e.target?.closest?.('[data-fcopy]');
  if (c) {
    e.preventDefault(); const text = c.dataset.fcopy;
    const done = () => { toast(`Copied: ${text}`, { ok: true }); const sp = c.querySelector('span'); if (sp) { sp.textContent = 'Copied'; setTimeout(() => { if (c.isConnected) sp.textContent = 'Copy'; }, 1600); } };
    const hand = () => toast(`Copying is blocked in this browser. Select it instead: ${text}`);
    try { navigator.clipboard.writeText(text).then(done, hand); } catch { hand(); }
    return;
  }
  const no = e.target?.closest?.('[data-fnofile]');
  if (no) { e.preventDefault(); const b = (S.bills || []).find(x => String(x.id) === no.dataset.v6b), d = b && (S.drafts?.[b.id] || []).find(x => String(x.id) === no.dataset.v6d); if (b && d) noFile(b, d, no); return; }
  const go = e.target?.closest?.('[data-fgo]'); if (!go) return;
  e.preventDefault();
  const b = (S.bills || []).find(x => String(x.id) === go.dataset.v6b), d = b && (S.drafts?.[b.id] || []).find(x => String(x.id) === go.dataset.v6d);
  if (b && d) markFiled(b, d, go.closest('.tf-wrap') || document, go, HOOK_AFTER);
});
let HOOK_AFTER = null;
// The redraw after an inline Mark filed (the Testimony screen's); a sheet uses the one steps.js hands it.
export const setFilingAfter = fn => { HOOK_AFTER = fn; };
// Every File and Mark filed in the app opens this card (steps.js ACTS.filed).
setStepHook('file', (b, d, o = {}) => openFiling(b, d, o));
