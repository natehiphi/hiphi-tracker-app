// Staff7's "Public words" list (R-398 part 2, design section 9), at #/public: what waits for an admin, the bills the person still has to write for, and their own
// changes from the last 30 days. Public mode (frame.js). Each row opens the page that does the job. counts(me) gives Home the numbers the rows show (design 6), so
// they always match. The only press here is Take back, which keeps the words on the bill for the writer first (the public site is unchanged).
import { S, isLiveBill, heldFor, waitingPosition, waitingChanges, myPublicChanges, publicPositionPending, isPublicSide, pubPoints, advocate, positionIsMine } from '../staff6/data.js';
import { hearingAhead } from '../staff6/model.js';
import { leadIds } from './bill_words.js';
import { billName, billNo } from './steps.js';
import { esc, personMark, toast } from './parts.js';
import { ic } from './icons7.js';
import { missingLine, readyLine, sentBackLine, saveDraftWords, draftWords, takeBackChange, TAKEN_BACK_HELP, TAKE_BACK_BUTTON, BAND, LEAVE_PUBLIC, LEAVE_SHORT,
  waitingState, APPROVED_STATE, WITHDRAWN_POSITION, positionChange, whatChanged, CHANGE_NAMES, OTHER_LABELS, sentAt, hearingDay, NOTHING_WAITS, LIST_WAITING, LIST_TO_WRITE,
  LIST_YOURS, LIST_WAITING_HELP, LIST_TO_WRITE_HELP, LIST_YOURS_HELP, PUBLIC_WORDS_HEAD, TAKEN_BACK, firstWordsOf, isFirstWords } from './public_data.js';

const enc = encodeURIComponent, $ = id => document.getElementById(id);
const normNo = s => String(s ?? '').replace(/\s/g, '').toUpperCase();
const firstOf = id => { const a = id ? advocate(id) : null; return (a?.full_name || '').split(' ')[0] || 'someone'; };
const issueOf = b => { const x = (S.billIssues || []).find(y => y.bill_id === b.id); return x ? (S.issues || []).find(z => z.id === x.issue_id && !z.archived_at) || null : null; };
const norm = v => Array.isArray(v) ? v.map(x => String(x?.text ?? x ?? '').trim()).filter(Boolean).join('\n') : String(v ?? '').trim();

// The bill's words that a change holds and that differ from what the public site shows (what the change says it changes).
const changedKeys = pc => Object.keys(pc.fields || {}).filter(k => k !== 'is_public' && k in CHANGE_NAMES && norm(pc.fields[k]) !== norm(pc.before?.[k]));
function changeWords(pc, b) {
  if (pc.kind === 'position') return positionChange(pc.before?.public_position ?? b?.public_position ?? null, pc.fields?.public_position ?? null);
  if (pc.kind === 'issue' || pc.kind === 'list') return whatChanged(Object.keys(pc.fields || {}).map(k => OTHER_LABELS[k] || k));
  if (isFirstWords(pc)) return firstWordsOf(pc);   // fix 8: a bill's first public words are named once, by what was sent
  return whatChanged(changedKeys(pc).map(k => CHANGE_NAMES[k]));
}
// One row can hold a bill's words and its position (fix 3): what changed, both parts, joined.
const changeWordsOf = (parts, b) => parts.map(pc => changeWords(pc, b)).filter(Boolean).join(' and ');
// What a change is about: its bill (number and name), or its issue or list.
function targetOf(pc) {
  if (pc.kind === 'bill' || pc.kind === 'position') { const b = S.bills.find(x => x.id === pc.target_id) || null; return { bill: b, name: b ? billName(b) : 'A bill', no: b ? billNo(b) : '' }; }
  const row = pc.kind === 'issue' ? (S.issues || []).find(x => x.id === pc.target_id) : (S.lists || []).find(x => x.id === pc.target_id);
  return { bill: null, name: row ? (row.name || row.title || '') : '', no: '' };
}

// ---------------------------------------------------------------------------------- the rows, and the numbers Home shows
// One row per bill for the waiting changes (fix 3): a bill's words change and its position change are one row, one step. Each row is { pc, parts }: pc is the
// row's change (the newest of its parts, the link), parts the waiting changes it holds.
const billKey = pc => (pc.kind === 'bill' || pc.kind === 'position') ? 'b:' + pc.target_id : 'x:' + pc.id;
export function groupWaiting(list) {
  const seen = new Map();
  for (const pc of list) { const k = billKey(pc); if (seen.has(k)) seen.get(k).parts.push(pc); else seen.set(k, { pc, parts: [pc] }); }
  return [...seen.values()];
}
// Waiting for you (an admin's): one row per waiting bill or item, in the order the database lists them.
export const waitingRows = (me = S.me) => me?.is_admin ? groupWaiting(waitingChanges()) : [];
// Bills to write: a side bill whose words, or whose new position, the public site does not show, with no change waiting on it. Its lead, or whoever
// changed the position, writes it; an admin also has his own unpublished position here (design 9). own: the admin's own position (publish it).
// A bill with a sent back change of the person's is already a Fix step on To do, so it is not counted here (fix 10).
export function toWriteRows(me = S.me) {
  const moved = new Set(myPublicChanges().filter(x => x.kind === 'position').map(x => x.target_id)), out = [];
  for (const b of S.bills) {
    if (b.tracked === false || !isPublicSide(b.position)) continue;
    if (heldFor('bill', b.id) || waitingPosition(b.id)) continue;   // a waiting change has its own page
    if (myPublicChanges().some(x => x.status === 'sent_back' && x.target_id === b.id)) continue;   // its Fix step is on To do
    const posPending = publicPositionPending(b);
    if (posPending && positionIsMine(b, me)) { out.push({ b, own: true }); continue; }
    if (posPending && (me?.is_admin || (S.publicChanges || []).some(x => x.kind === 'position' && x.target_id === b.id && x.status === 'sent_back'))) continue;   // a teammate's position is theirs to fix
    const lead = leadIds(b, issueOf(b)).includes(me?.id);
    if ((lead || moved.has(b.id)) && (!isLiveBill(b) || posPending)) out.push({ b, own: false });
  }
  return out;
}
// Your changes: the signed-in person's changes from the last 30 days, one row per bill for the waiting ones (fix 3).
export const mineRows = () => {
  const out = [], seen = new Map();
  for (const pc of myPublicChanges()) {
    if (pc.status === 'waiting' && (pc.kind === 'bill' || pc.kind === 'position')) {
      const k = 'b:' + pc.target_id;
      if (seen.has(k)) { seen.get(k).parts.push(pc); continue; }
      const row = { pc, parts: [pc] }; seen.set(k, row); out.push(row);
    } else out.push({ pc, parts: [pc] });
  }
  return out;
};

// Home's counts (design 6): waiting for an admin, bills to write, and the person's own changes that wait on Nate or were sent back.
export function counts(me = S.me) {
  return { waitingForMe: waitingRows(me).length, toWrite: toWriteRows(me).length, mine: mineRows().filter(r => r.pc.status === 'waiting' || r.pc.status === 'sent_back').length };
}

// ---------------------------------------------------------------------------------- the HTML
const chev = `<span class="pl-chev" aria-hidden="true">${ic('chevron-right')}</span>`;
const section = (title, help, rows) => `<section class="pl-sec" aria-labelledby="pl-${esc(title.replace(/\W+/g, '-').toLowerCase())}"><h2 id="pl-${esc(title.replace(/\W+/g, '-').toLowerCase())}">${esc(title)}</h2>`
  + `<p class="pub-help pl-help">${esc(help)}</p><ul class="pl-rows">${rows.join('')}</ul></section>`;

function waitingRow({ pc, parts }) {
  const t = targetOf(pc), h = t.bill ? hearingAhead(t.bill) : null, who = advocate(pc.proposed_by);
  const meta = [changeWordsOf(parts, t.bill), sentAt(pc.proposed_at), h ? hearingDay(h.scheduled_at) : ''].filter(Boolean).join(' · ');
  return `<li class="pl-row"><a class="pl-link" href="#/public/change/${enc(pc.id)}"><span class="pl-body"><span class="pl-title"><span class="pl-name">${esc(t.name)}</span>${t.no ? `<span class="pl-no">${esc(t.no)}</span>` : ''}</span>`
    + `<span class="pl-meta">${personMark(who?.initials || '', { small: true })}<span>${esc(firstOf(pc.proposed_by))} · ${esc(meta)}</span></span></span>${chev}</a></li>`;
}

function writeRow({ b, own }) {
  const posPending = publicPositionPending(b), miss = missingLine(b), ready = !miss;
  const meta = posPending ? positionChange(b.public_position, b.position) : '';
  const state = miss || readyLine(S.me);
  const href = own ? `#/public/change/${enc(POS(b))}` : `#/public/${enc(normNo(b.bill_number))}`;
  return `<li class="pl-row"><a class="pl-link" href="${esc(href)}"><span class="pl-body"><span class="pl-title"><span class="pl-name">${esc(billName(b))}</span><span class="pl-no">${esc(billNo(b))}</span></span>`
    + `${meta ? `<span class="pl-meta">${esc(meta)}</span>` : ''}<span class="pl-state${ready ? ' pl-ready' : ''}">${esc(state)}</span></span>${chev}</a></li>`;
}
const POS = b => 'position-' + normNo(b.bill_number);

// The change's words in the row, and what its state is in the row's own text. A sent back or taken back row opens the bill's public words with the person's words there.
// A row with a words change still waiting has Take back; a position change cannot be taken back (change the position back instead).
function mineRow({ pc, parts }) {
  const t = targetOf(pc), what = changeWordsOf(parts, t.bill), when = sentAt(pc.proposed_at);
  let state = '', link = '', act = '';
  if (pc.status === 'waiting') {
    state = waitingState();
    const words = parts.find(x => x.kind === 'bill' && x.status === 'waiting');
    if (words) act = `<button class="btn quiet pl-take" type="button" data-take="${esc(words.id)}">${esc(TAKE_BACK_BUTTON)}</button>`;
  } else if (pc.status === 'sent_back') { state = sentBackLine(pc); link = t.bill ? `#/public/${enc(normNo(t.bill.bill_number))}` : ''; }
  else if (pc.status === 'approved') state = APPROVED_STATE;
  else { state = pc.kind === 'position' ? WITHDRAWN_POSITION : TAKEN_BACK; link = t.bill ? `#/public/${enc(normNo(t.bill.bill_number))}` : ''; }
  const body = `<span class="pl-body"><span class="pl-title"><span class="pl-name">${esc(t.name)}</span>${t.no ? `<span class="pl-no">${esc(t.no)}</span>` : ''}</span>`
    + `<span class="pl-meta">${esc(what)}${what ? ' · ' : ''}${esc(when)}</span><span class="pl-state">${esc(state)}</span></span>`;
  const main = link ? `<a class="pl-link" href="${esc(link)}" data-prep="${esc(pc.id)}">${body}${chev}</a>` : `<div class="pl-link pl-still">${body}</div>`;
  return `<li class="pl-row">${main}${act}</li>`;
}

// ---------------------------------------------------------------------------------- the page
export function publicListPage({ q, back = '' }) {
  const me = S.me, admin = !!me?.is_admin;
  const wait = waitingRows(me).map(waitingRow), write = toWriteRows(me).map(writeRow), mine = mineRows().map(mineRow);
  const parts = [
    admin && wait.length ? section(LIST_WAITING, LIST_WAITING_HELP, wait) : '',
    write.length ? section(LIST_TO_WRITE, LIST_TO_WRITE_HELP, write) : '',
    mine.length ? section(LIST_YOURS, LIST_YOURS_HELP, mine) : '',
  ];
  // an admin sees Waiting for you first; a lead sees Bills to write first (design 9)
  const body = parts.filter(Boolean).join('') || `<p class="pl-none">${esc(NOTHING_WAITS)}</p>`;
  const band = `<header class="pub-band"><div class="pub-wrap"><p class="pub-band-words"><b>${esc(BAND)}</b></p>`
    + `<a class="btn quiet" href="${esc(back || '#/')}"><span class="pub-long">${esc(LEAVE_PUBLIC)}</span><span class="pub-short">${esc(LEAVE_SHORT)}</span></a></div></header>`;
  return { html: `<div class="pub pl-page" id="pubRoot">${band}<div class="pub-wrap pl-wrap"><h1 id="pubH1" tabindex="-1">${esc(PUBLIC_WORDS_HEAD)}</h1>${body}</div></div>`,
    bind: () => { $('pubRoot')?.addEventListener('click', onClick); $('pubH1')?.focus({ preventScroll: true }); } };
}

// ---------------------------------------------------------------------------------- the presses on this page
// Take back: the writer's words stay on the bill (kept as the person's draft, so they are there to edit), and the change is withdrawn.
function onClick(e) {
  const take = e.target.closest('[data-take]');
  if (take) return takeBack(take.dataset.take);
  const link = e.target.closest('[data-prep]');
  if (link) { const pc = (S.publicChanges || []).find(x => x.id === link.dataset.prep); if (pc) prepDraft(pc, false); }
}
// The words a change holds, on top of the bill's words as the public site has them (what a writer sees when they open the bill).
function wordsOf(b, pc) {
  const F = { nickname: b.nickname ?? '', public_summary: b.public_summary ?? '', talking_points: pubPoints(b), public_action: b.public_action ?? '', public_action_until: b.public_action_until ?? '' };
  for (const k of Object.keys(F)) if (k in (pc.fields || {})) F[k] = pc.fields[k];
  return F;
}
// A sent back or taken back change's words are kept on the bill for its writer, unless the bill already has a draft.
function prepDraft(pc, force) {
  const b = pc.kind === 'bill' ? S.bills.find(x => x.id === pc.target_id) : null;
  if (!b || (!force && draftWords(b.id))) return;
  saveDraftWords(b.id, wordsOf(b, pc));
}
function takeBack(id) {
  const pc = (S.publicChanges || []).find(x => x.id === id); if (!pc) return;
  prepDraft(pc, true);   // the words it held are kept for the writer, before the change is withdrawn
  const r = takeBackChange(id);
  if (r.refused) toast(r.refused, { ms: 6000 });
  else toast(TAKEN_BACK_HELP, { ms: 6000 });
  window.__staff7Render?.({});
}
