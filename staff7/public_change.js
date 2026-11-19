// Staff7's admin page for a waiting public change (R-398 part 2, design section 8). #/public/change/<id> shows one waiting change: a bill's words, its position, or both
// on one page (each part says whose it is). #/public/change/position-<bill number> shows an admin's own unpublished position (publishPosition). Public mode (frame.js).
// Approve, Send back and Publish toast at once and move on to the next waiting change (or Home); the decision itself runs 10 seconds later, unless Undo returns to the
// change (design 3.6). Before the toast, the page checks that what it was opened on is still what the public site shows (design 10.3): if not, it is drawn again and
// says so. The rules (who decides, the bar, a stale approve, a decided change) are the data layer's; the words are public_data.js's.
import { S, DB, advocate, isLiveBill, heldFor, waitingPosition, waitingChanges, pubPoints, isPublicSide, hstToday, savePractice } from '../staff6/data.js';
import { hearingAhead } from '../staff6/model.js';
import { testimonyDue, dateY } from './bill_words.js';
import { billName, billNo } from './steps.js';
import { esc, btn, toast, personMark } from './parts.js';
import { decidePublicChangeV7, publicStateOf, publishPosition, barMet, publicPositionPending, BAND, LEAVE_PUBLIC, LEAVE_SHORT, PREVIEW_HEAD, PREVIEW_TAG,
  AFTER_APPROVE, AFTER_PUBLISH, HEAD_APPROVE, HEAD_PUBLISH, APPROVE_BUTTON, SEND_BACK_BUTTON, PUBLISH_BUTTON, SEND_BACK_NOTE_LABEL, SEND_BACK_NOTE_HELP, sendBackHears,
  ON_SITE_AFTER_APPROVE, PUBLISH_IN_10, SEND_BACK_IN_10, CANCEL, APPROVED_TOAST, SENT_BACK_TOAST, WORDS_ON_SITE_TOAST, barRefusal, hearingLine, pubPositionWords,
  ASK_LABEL, POINTS_LABEL, POINTS_NOW, POSITION_LABEL, CHANGE_NOW_HEAD, changeHead, partName, LEG_TITLE_ONLY, NOTHING_THERE, TAKEN_OUT, NO_LAST_DAY, NO_WORD_CHANGE,
  sentThis, changedOurs, ownSaved, positionCheck, teamAlreadySees, posWord, CHANGE_NAMES, OTHER_LABELS, ASK_EXPIRED_CHANGE, CHANGED_HELP, ONLY_ADMIN, BILL_WORDS_LINK,
  BACK_PUBLIC, GONE_CHANGE, DECIDED_BY, CHANGED_SINCE, NOT_TRACKED, TAKEN_BACK_HELP, waitingLine, pointLabel, YES_WORD, NO_WORD, YOU_CHANGED_POS } from './public_data.js';

const TEN = 10000, enc = encodeURIComponent, $ = id => document.getElementById(id);
const POS = 'position-', WORD_KEYS = ['nickname', 'public_summary', 'talking_points', 'public_action', 'public_action_until'];
const txt = v => String(v ?? '').trim();
const normNo = s => String(s ?? '').replace(/\s/g, '').toUpperCase();
const findBill = no => S.bills.find(x => normNo(x.bill_number) === normNo(no)) || null;
const firstOf = id => { const a = id ? advocate(id) : null; return (a?.full_name || '').split(' ')[0] || 'someone'; };
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

let cur = null;                   // the page as drawn: { id, model, back, noteOpen, note, status }
let keptNote = null;              // a note typed before Undo, put back when the change is opened again
const pendings = new Map();       // a decision waiting out its 10 seconds, by its first change id

// What the public site holds for a bill, in the form's shape (a bill not on the public site holds nothing).
const publicWordsOf = b => ({ nickname: txt(b.nickname), public_summary: txt(b.public_summary), talking_points: pubPoints(b), public_action: txt(b.public_action), public_action_until: txt(b.public_action_until) });
const EMPTY = { nickname: '', public_summary: '', talking_points: [], public_action: '', public_action_until: '' };
// A change's words, trimmed, blank points left out: what is compared and counted.
const fieldsOf = pc => { const f = pc.fields || {}; return { nickname: txt(f.nickname), public_summary: txt(f.public_summary), talking_points: (Array.isArray(f.talking_points) ? f.talking_points : []).map(x => txt(x?.text ?? x)).filter(Boolean),
  public_action: txt(f.public_action), public_action_until: txt(f.public_action_until) }; };

// ---------------------------------------------------------------------------------- what the page is about
// The page's model: the bill (or the item, an issue or a list), its parts (words, position; each with its change or null for an admin's own position), who may decide,
// and the public state it was opened on (seen). Re-read from the data every time the page is drawn.
function build(id) {
  const me = S.me, m = { id, admin: !!me?.is_admin, bill: null, item: null, parts: [], gone: '', state: '', by: '', own: false, seen: null };
  if (!me) { m.gone = GONE_CHANGE; return m; }
  let pc = null;
  if (!id.startsWith(POS)) {
    pc = (S.publicChanges || []).find(x => x.id === id) || null;
    if (!pc) { m.gone = GONE_CHANGE; return m; }
    if (pc.kind === 'issue' || pc.kind === 'list') return buildItem(m, pc);
  }
  const bill = pc ? S.bills.find(x => x.id === pc.target_id) : findBill(id.slice(POS.length));
  if (!bill) { m.gone = GONE_CHANGE; return m; }
  m.bill = bill;
  if (bill.tracked === false) { m.gone = NOT_TRACKED; return m; }
  if (pc && pc.status !== 'waiting') {   // decided by someone else (or taken back by its writer): calm, never an error (design 10.8)
    m.state = pc.status === 'withdrawn' && pc.proposed_by === me.id ? 'taken' : 'decided';
    m.by = firstOf(pc.decided_by);
    return m;
  }
  const words = heldFor('bill', bill.id), pos = waitingPosition(bill.id);
  if (words) m.parts.push({ kind: 'words', pc: words });
  if (pos) m.parts.push({ kind: 'position', pc: pos });
  else if (m.admin && publicPositionPending(bill)) m.parts.push({ kind: 'position', pc: null });   // an admin's own unpublished position
  if (!m.parts.length) { m.gone = GONE_CHANGE; return m; }
  m.own = m.parts.every(p => !p.pc || p.pc.proposed_by === me.id);
  m.seen = publicStateOf(bill.id);
  return m;
}
function buildItem(m, pc) {
  const me = S.me, row = pc.kind === 'issue' ? (S.issues || []).find(x => x.id === pc.target_id) : (S.lists || []).find(x => x.id === pc.target_id);
  if (!row) { m.gone = GONE_CHANGE; return m; }
  m.item = { name: row.name || row.title || '', row };
  if (pc.status !== 'waiting') { m.state = pc.status === 'withdrawn' && pc.proposed_by === me.id ? 'taken' : 'decided'; m.by = firstOf(pc.decided_by); return m; }
  m.parts = [{ kind: 'item', pc }];
  m.own = pc.proposed_by === me.id;
  return m;
}
// The bill as it would be once the parts are approved: the words and the position each part would set (for the bar and the preview).
function mergedBill(m) {
  const B = S.bills.find(x => x.id === m.bill.id) || m.bill;
  let M = { ...B };
  for (const p of m.parts) {
    if (p.kind === 'words') { const F = fieldsOf(p.pc); for (const k of WORD_KEYS) if (k in p.pc.fields) M[k] = F[k]; }
    if (p.kind === 'position') M.public_position = p.pc ? p.pc.fields.public_position ?? null : B.position ?? null;
  }
  return M;
}
// The approve press is off while the bar is not met: the reason, in plain words (design 8). Null when it can be approved.
function offReason(m) {
  if (!m.bill || m.item) return null;
  const M = mergedBill(m);
  return barMet(M) ? null : barRefusal(M);
}
const asksExpired = m => m.parts.some(p => p.kind === 'words' && fieldsOf(p.pc).public_action && fieldsOf(p.pc).public_action_until && fieldsOf(p.pc).public_action_until < hstToday());

// ---------------------------------------------------------------------------------- the page
export function publicChangePage({ id, q, back = '' }) {
  const keep = keptNote && keptNote.id === id ? keptNote : null; keptNote = null;
  cur = { id, back, model: build(id), noteOpen: !!keep, note: keep ? keep.note : '', status: '' };
  return { html: pageHTML(), bind: () => { attach(); refresh(); $('pubH1')?.focus({ preventScroll: true }); } };
}

function pageHTML() {
  const m = cur.model, B = m.bill, back = cur.back || '#/';
  const band = `<header class="pub-band"><div class="pub-wrap"><p class="pub-band-words"><b>${esc(BAND)}</b>${B ? `<span class="pub-band-bill">${esc(billNo(B))} · ${esc(billName(B))}</span>` : m.item ? `<span class="pub-band-bill">${esc(m.item.name)}</span>` : ''}</p>`
    + `<a class="btn quiet" href="${esc(back)}"><span class="pub-long">${esc(LEAVE_PUBLIC)}</span><span class="pub-short">${esc(LEAVE_SHORT)}</span></a></div></header>`;
  if (m.gone || m.state || !m.admin) return `<div class="pub" id="pubRoot">${band}<div class="pub-wrap pub-empty">${emptyHTML(m)}</div></div>`;
  return `<div class="pub" id="pubRoot">${band}<div class="pub-wrap pub-grid">${formHTML(m)}${m.item ? '' : sideHTML(m)}</div>`
    + `<footer class="pub-dock" id="pubDock"><div class="pub-wrap" id="pubDockIn">${dockHTML(m)}</div></footer></div>`;
}
const headOf = m => m.own ? HEAD_PUBLISH : HEAD_APPROVE;

// Not an admin, or the change is gone or decided: a calm line and the way on (design 8, 10.8).
function emptyHTML(m) {
  const back = `<p><a class="pub-link" href="#/public">${esc(BACK_PUBLIC)}</a></p>`;
  const bill = m.bill ? `<p><a class="pub-link" href="#/public/${enc(normNo(m.bill.bill_number))}">${esc(BILL_WORDS_LINK)}</a></p>` : '';
  if (m.gone) return `<h1 id="pubH1" tabindex="-1">${esc(HEAD_APPROVE)}</h1><p class="pc-lead">${esc(m.gone)}</p>${back}`;
  if (m.state) return `<h1 id="pubH1" tabindex="-1">${esc(HEAD_APPROVE)}</h1><p class="pc-lead">${esc(m.state === 'taken' ? TAKEN_BACK_HELP : DECIDED_BY(m.by))}</p>${bill}${back}`;
  const mine = m.parts.map(p => p.pc).find(x => x && x.proposed_by === S.me?.id);
  return `<h1 id="pubH1" tabindex="-1">${esc(HEAD_APPROVE)}</h1><p class="pc-lead">${esc(ONLY_ADMIN)}</p>${mine ? `<p class="pc-lead">${esc(waitingLine(mine))}</p>` : ''}${bill}${back}`;
}

function formHTML(m) {
  const B = m.bill, multi = m.parts.length > 1, out = [];
  const name = m.item ? m.item.name : billName(B), no = B ? billNo(B) : '';
  out.push(`<h1 id="pubH1" tabindex="-1">${esc(headOf(m))}</h1>`);
  out.push(`<p class="pc-bill"><span class="pc-name">${esc(name)}</span>${no ? ` <span class="pc-no">${esc(no)}</span>` : ''}</p>`);
  const h = B ? hearingAhead(B) : null;
  if (h) out.push(`<p class="pc-hear">${esc(hearingLine(h.scheduled_at, new Date(testimonyDue(h)).toISOString()))}</p>`);
  out.push(`<div class="pc-status" id="pcStatus" role="status">${esc(cur.status)}</div>`);
  for (const p of m.parts) out.push(partHTML(m, p, multi));
  if (asksExpired(m)) out.push(`<p class="pc-warn">${esc(ASK_EXPIRED_CHANGE)}</p>`);
  if (cur.noteOpen) out.push(noteHTML(m));
  return `<section class="pub-form pc-form">${out.join('')}</section>`;
}

// Whose the part is, when it was sent, and what it changes: two cards per changed thing (the public site now, the change).
function partHTML(m, p, multi) {
  const pc = p.pc, own = !pc || pc.proposed_by === S.me?.id, who = pc ? firstOf(pc.proposed_by) : '';
  const head = multi ? `<h2 class="pc-part">${esc(partName(who, p.kind === 'position' ? 'the position' : 'the words', own))}</h2>` : '';
  const body = p.kind === 'position' ? positionBody(m, p) : p.kind === 'item' ? itemBody(m, p) : wordsBody(m, p, who, own);
  return `${head}${sentLine(p)}${body}`;
}
function sentLine(p) {
  const pc = p.pc, mine = !pc || pc.proposed_by === S.me?.id;
  const ini = mine ? S.me?.initials : advocate(pc.proposed_by)?.initials;
  const who = mine ? 'You' : firstOf(pc.proposed_by);
  let text;
  if (p.kind === 'position' && !pc) text = YOU_CHANGED_POS;
  else if (p.kind === 'position') text = mine ? changedOurs('You', pc.proposed_at) : changedOurs(who, pc.proposed_at);
  else text = mine ? ownSaved(pc.proposed_at) : sentThis(who, pc.proposed_at);
  const rest = text.startsWith(who) ? text.slice(who.length) : ` ${text}`;
  return `<p class="pc-sent">${personMark(ini || '', { small: true })}<span><b>${esc(who)}</b>${esc(rest)}</span></p>`;
}

// ---- the cards ----
const none = t => `<span class="pc-none">${esc(t)}</span>`;
function pair(label, L, R, who, own, cls = '') {
  return `<div class="pc-pair"><h3 class="pc-lab">${esc(label)}</h3><div class="pc-cards">`
    + `<div class="pc-card is-now"><p class="pc-card-h">${esc(CHANGE_NOW_HEAD)}</p><div class="pc-card-b${cls}">${L}</div></div>`
    + `<div class="pc-card is-new"><p class="pc-card-h">${esc(changeHead(who, own))}</p><div class="pc-card-b${cls}">${R}</div></div></div></div>`;
}
// Word by word: the words that changed are struck through on the left and underlined on the right; the rest is plain (design 8).
const tokens = s => String(s).split(/(\s+)/).filter(x => x !== '');
function diff(a, b) {
  const x = tokens(a), y = tokens(b), n = x.length, k = y.length, T = [];
  for (let i = 0; i <= n; i++) T.push(new Uint16Array(k + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = k - 1; j >= 0; j--) T[i][j] = x[i] === y[j] ? T[i + 1][j + 1] + 1 : Math.max(T[i + 1][j], T[i][j + 1]);
  const xs = new Array(n).fill(false), ys = new Array(k).fill(false);
  let i = 0, j = 0;
  while (i < n && j < k) { if (x[i] === y[j]) { i++; j++; } else if (T[i + 1][j] >= T[i][j + 1]) xs[i++] = true; else ys[j++] = true; }
  while (i < n) xs[i++] = true;
  while (j < k) ys[j++] = true;
  const join = (t, s) => { for (let q = 1; q < t.length - 1; q++) if (/^\s+$/.test(t[q]) && s[q - 1] && s[q + 1]) s[q] = true; };   // a space between two changed words is changed too
  join(x, xs); join(y, ys);
  const html = (t, s, cls) => t.map((w, q) => s[q] ? `<span class="${cls}">${esc(w)}</span>` : esc(w)).join('');
  return { l: html(x, xs, 'pc-del'), r: html(y, ys, 'pc-ins') };
}
// A text thing: its marks when the public site shows words; the Legislature's title only when it does not (design 8).
function textPair(label, a, b, live, who, own) {
  const d = live && (a || b) ? diff(a, b) : null;
  const L = !live ? none(LEG_TITLE_ONLY) : !a ? none(NOTHING_THERE) : d.l;
  const R = !b ? none(TAKEN_OUT) : live ? d.r : esc(b);
  return pair(label, L, R, who, own);
}
function datePair(label, a, b, live, who, own) {
  const L = !live ? none(LEG_TITLE_ONLY) : a ? esc(dateY(a)) : none(NO_LAST_DAY);
  const R = b ? esc(dateY(b)) : none(NO_LAST_DAY);
  return pair(label, L, R, who, own);
}

function wordsBody(m, p, who, own) {
  const B = m.bill, live = isLiveBill(B), F = fieldsOf(p.pc), base = live ? publicWordsOf(B) : EMPTY, has = k => k in p.pc.fields, out = [];
  for (const k of ['nickname', 'public_summary']) if (has(k) && txt(base[k]) !== F[k]) out.push(textPair(CHANGE_NAMES[k], txt(base[k]), F[k], live, who, own));
  if (has('talking_points')) {
    const A = base.talking_points, Bp = F.talking_points, n = Math.max(A.length, Bp.length);
    for (let i = 0; i < n; i++) if (txt(A[i]) !== txt(Bp[i])) out.push(textPair(pointLabel(i + 1), txt(A[i]), txt(Bp[i]), live, who, own));
  }
  if (has('public_action') && txt(base.public_action) !== F.public_action) out.push(textPair(CHANGE_NAMES.public_action, txt(base.public_action), F.public_action, live, who, own));
  if (has('public_action_until') && txt(base.public_action_until) !== F.public_action_until) out.push(datePair(CHANGE_NAMES.public_action_until, txt(base.public_action_until), F.public_action_until, live, who, own));
  return out.length ? out.join('') : `<p class="pc-help">${esc(NO_WORD_CHANGE)}</p>`;
}

// A position: the cards, then the two lines (the team's and the words' check), then the talking points once (design 7, 8).
function positionBody(m, p) {
  const B = m.bill, live = isLiveBill(B), own = !p.pc || p.pc.proposed_by === S.me?.id, who = p.pc ? firstOf(p.pc.proposed_by) : '';
  const was = live ? B.public_position ?? null : null, now = p.pc ? p.pc.fields.public_position ?? null : B.position ?? null;
  const L = live ? `<span class="pc-big">${esc(posWord(was))}</span>` : none(LEG_TITLE_ONLY);
  const R = `<span class="pc-big">${esc(posWord(now))}</span>`;
  let out = pair(POSITION_LABEL, L, R, who, own, ' pc-bigw');
  out += `<p class="pc-line">${esc(teamAlreadySees(posWord(B.position)))}</p>`;
  if (live) out += `<p class="pc-line">${esc(positionCheck(posWord(was)))}</p>`;
  if (!m.parts.some(q => q.kind === 'words' && 'talking_points' in q.pc.fields)) out += pointsNow(B);
  return out;
}
function pointsNow(B) {
  const pts = pubPoints(B);
  return `<div class="pc-pts"><h3 class="pc-lab">${esc(POINTS_NOW)}</h3>${pts.length ? `<ul>${pts.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : `<p class="pc-help">${esc(NOTHING_THERE)}</p>`}</div>`;
}

// An issue's or a list's change: its fields, the same two cards (no bar, design 8).
const norm = v => Array.isArray(v) ? v.map(x => txt(x?.text ?? x)).filter(Boolean).join('\n') : (typeof v === 'boolean' ? String(v) : txt(v));
function itemBody(m, p) {
  const pc = p.pc, row = m.item.row, before = pc.before || {}, who = firstOf(pc.proposed_by), own = pc.proposed_by === S.me?.id, out = [];
  for (const k of Object.keys(pc.fields || {})) {
    const a = before[k] ?? row?.[k] ?? null, b = pc.fields[k] ?? null;
    if (norm(a) === norm(b)) continue;
    const label = OTHER_LABELS[k] || k;
    if (typeof a === 'boolean' || typeof b === 'boolean') out.push(pair(label, esc(a ? YES_WORD : NO_WORD), esc(b ? YES_WORD : NO_WORD), who, own));
    else out.push(textPair(label, txt(a), txt(b), true, who, own));
  }
  return out.join('') || `<p class="pc-help">${esc(NO_WORD_CHANGE)}</p>`;
}

// The preview on the right, drawn with the change applied and tagged "After you approve" (design 3.3).
function sideHTML(m) {
  return `<section class="pub-side"><h2 class="pub-pv-h">${esc(PREVIEW_HEAD)}</h2><div class="pub-card" id="pcCard" tabindex="0" role="region" aria-label="${esc(PREVIEW_HEAD)}">${previewHTML(m)}</div></section>`;
}
function previewHTML(m) {
  const B = m.bill, live = isLiveBill(B);
  let W = { ...(live ? publicWordsOf(B) : EMPTY), talking_points: [...(live ? publicWordsOf(B).talking_points : [])] }, pos = live ? B.public_position ?? null : B.position ?? null;
  for (const p of m.parts) {
    if (p.kind === 'words') { const F = fieldsOf(p.pc); for (const k of WORD_KEYS) if (k in p.pc.fields) W[k] = F[k]; }
    if (p.kind === 'position') pos = p.pc ? p.pc.fields.public_position ?? null : B.position ?? null;
  }
  const ask = W.public_action && !(W.public_action_until && W.public_action_until < hstToday()) ? W.public_action : '';
  const pp = pubPositionWords(pos);
  return `<div class="pv-head"><span>${esc(billNo(B))}</span><span class="pv-label">${esc(PREVIEW_TAG)}</span></div>`
    + `<p class="pv-tag">${esc(m.own ? AFTER_PUBLISH : AFTER_APPROVE)}</p>`
    + `<h3 class="pv-title">${esc(W.nickname || billName(B))}</h3>`
    + (pp ? `<p class="pv-pos">${esc(pp)}</p>` : '')
    + (W.public_summary ? `<p class="pv-sum">${esc(W.public_summary)}</p>` : '')
    + (ask ? `<p class="pv-ask"><b>${esc(ASK_LABEL)}</b> ${esc(ask)}</p>` : '')
    + (W.talking_points.length ? `<div class="pv-tp"><h4>${esc(POINTS_LABEL)}</h4><ul>${W.talking_points.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : '');
}

// The send back note, in place (design 8): it opens under the cards, and the dock turns to Send back and Cancel.
function noteHTML(m) {
  const c = m.parts.map(p => p.pc).find(Boolean), name = c ? firstOf(c.proposed_by) : '';
  return `<div class="pub-f pc-note"><label class="pub-lab" for="pcNote">${esc(SEND_BACK_NOTE_LABEL)}</label><p class="pub-help" id="pcNoteH">${esc(SEND_BACK_NOTE_HELP)}</p>`
    + `<textarea id="pcNote" class="pub-in" rows="2" maxlength="400" aria-describedby="pcNoteH pcNoteHear">${esc(cur.note)}</textarea>`
    + `<p class="pub-help" id="pcNoteHear">${esc(sendBackHears(name))}</p></div>`;
}

// The bottom row: the main button (switched off, with its reason, when the bar is not met), Send back, and the line that says what the press does (design 8).
function dockHTML(m) {
  if (cur.noteOpen) return `${btn(SEND_BACK_BUTTON, { kind: 'filled', id: 'pcSendBack' })}${btn(CANCEL, { kind: 'quiet', id: 'pcCancel' })}<p class="pub-dock-line" id="pcLine" aria-live="polite">${esc(SEND_BACK_IN_10)}</p>`;
  const off = offReason(m), own = m.own, go = own ? PUBLISH_BUTTON : APPROVE_BUTTON;
  const goBtn = `<button type="button" class="btn filled pub-go${off ? ' off' : ''}" id="pcGo" aria-disabled="${off ? 'true' : 'false'}">${esc(go)}</button>`;
  const second = own ? '' : btn(SEND_BACK_BUTTON, { kind: 'quiet', id: 'pcSendOpen' });
  const line = off || (own ? PUBLISH_IN_10 : ON_SITE_AFTER_APPROVE);
  return `${goBtn}${second}<p class="pub-dock-line" id="pcLine" aria-live="polite">${esc(line)}</p>`;
}

// ---------------------------------------------------------------------------------- the presses
function attach() { const root = $('pubRoot'); if (!root) return; root.addEventListener('input', onInput); root.addEventListener('click', onClick); }
function onInput(e) { if (e.target.id === 'pcNote') { cur.note = e.target.value.slice(0, 400); grow(e.target); } }
function onClick(e) {
  const b = e.target.closest('button'); if (!b || !cur) return;
  const act = { pcGo: press, pcSendOpen: openNote, pcCancel: closeNote, pcSendBack: pressBack }[b.id];
  if (act) act();
}
function press() { if (!cur.model.admin) return; decideNow(cur.model.own ? 'publish' : 'approve', ''); }
function pressBack() { decideNow('back', cur.note.trim()); }
function openNote() { cur.noteOpen = true; paint('pcNote'); }
function closeNote() { cur.noteOpen = false; cur.note = ''; paint('pcSendOpen'); }

// Approve, Send back or Publish: the toast comes at once and the page moves on; the decision runs in 10 seconds unless Undo returns to the change.
function decideNow(kind, note) {
  const m = cur.model;
  if (m.gone || m.state || !m.admin) return;
  if (kind !== 'back' && offReason(m)) return;
  // the page is only decided on what it was opened on: if the public site or a part moved since, it is drawn again and nothing is decided (design 10.3)
  const moved = m.parts.some(p => p.pc && p.pc.status !== 'waiting') || (m.seen && !same(publicStateOf(m.bill.id), m.seen));
  if (moved) {
    const still = m.parts.every(p => !p.pc || p.pc.status === 'waiting');
    cur.model = build(m.id); cur.noteOpen = false; cur.note = ''; cur.status = still ? CHANGED_HELP : ''; paint('pubH1');
    return;
  }
  const ids = m.parts.map(p => p.pc ? p.pc.id : POS + normNo(m.bill.bill_number));
  const key = ids[0], next = nextChange(ids), back = '#/public/change/' + enc(m.id);
  const run = () => decide(m, kind, note);
  const t = setTimeout(() => settle(key), TEN);
  pendings.set(key, { ids, t, run, back, note, id: m.id });
  const msg = kind === 'back' ? SENT_BACK_TOAST : kind === 'publish' ? WORDS_ON_SITE_TOAST : APPROVED_TOAST;
  const undo = () => { const p = pendings.get(key); if (!p) return; clearTimeout(p.t); pendings.delete(key); keptNote = p.note ? { id: p.id, note: p.note } : null; location.hash = p.back; };
  go(next ? '#/public/change/' + enc(next.id) : '#/', msg, undo);
}
// The next waiting change that no page and no pending decision holds (the order of Waiting for you).
function nextChange(ids) {
  const held = new Set(ids);
  for (const p of pendings.values()) p.ids.forEach(x => held.add(x));
  return waitingChanges().find(x => !held.has(x.id)) || null;
}
// The page moves on at once; the toast is shown on the page it lands on, after that page is drawn (frame.js draws and clears the toast on a new address).
function go(hash, msg, undo) {
  addEventListener('hashchange', () => toast(msg, { undo, ms: TEN }), { once: true });
  location.hash = hash;
}
// A decision that has waited its 10 seconds: it runs now. A refusal is said in a toast; then the Home or Public words page is drawn again so its numbers match.
function settle(key, quiet = false) {
  const p = pendings.get(key); if (!p) return;
  clearTimeout(p.t); pendings.delete(key);
  const r = p.run();
  const done = err => { if (err && !quiet) toast(err, { ms: 6000 }); if (!quiet && /^#\/?(public\/?)?$/.test(location.hash)) window.__staff7Render?.({}); };
  if (r && typeof r.then === 'function') r.then(done, e => done((e && e.message) || 'It did not go.')); else done(r);
}
addEventListener('pagehide', () => { if (!pendings.size) return; [...pendings.keys()].forEach(k => settle(k, true)); savePractice(); });   // a decision still counting down is sent now, so leaving never cancels it (design 3.6)

// Runs the decision. Returns a refusal in plain words, '' when it went, or a promise of either (an issue or a list).
function decide(m, kind, note) {
  const approve = kind !== 'back';
  if (m.item) return DB.decidePublicChange(m.parts[0].pc.id, approve, note).then(() => '', e => (e && e.message) || 'It did not go.');
  const B = m.bill;
  let seenNow = m.seen;
  for (const p of m.parts) {
    if (p.pc) {
      const r = decidePublicChangeV7(p.pc.id, approve, note, seenNow);
      if (r.refused) return refusal(r.refused, B, p);
      if (approve) seenNow = publicStateOf(B.id);   // the position is judged on the words as they now are
    } else if (approve) {   // an admin's own unpublished position
      if (!same(publicStateOf(B.id), seenNow)) return CHANGED_SINCE;
      const r = publishPosition(B.id);
      if (r.refused) return refusal(r.refused, B, p);
    }
  }
  return '';
}
function refusal(r, B, p) {
  if (r !== 'bar') return r;
  const fresh = S.bills.find(x => x.id === B.id) || B;
  return barRefusal(p.kind === 'position' ? { ...fresh, public_position: p.pc ? p.pc.fields.public_position : fresh.position } : { ...fresh, ...p.pc.fields });
}

// ---------------------------------------------------------------------------------- drawing helpers
function paint(focus) {
  const app = $('app'); if (!app || !cur) return;
  app.innerHTML = pageHTML(); attach(); refresh();
  const el = $(focus) || $('pubH1'); if (el) el.focus({ preventScroll: focus === 'pubH1' });
}
// Every text box grows to fit its words, and the page clears the dock (as public.js does).
function grow(el) { const border = el.offsetHeight - el.clientHeight; el.style.height = 'auto'; el.style.height = (el.scrollHeight + border) + 'px'; }
function refresh() {
  document.querySelectorAll('#pubRoot textarea.pub-in').forEach(grow);
  const dock = $('pubDock'), root = $('pubRoot'); if (!dock || !root) return;
  const gap = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--dock-gap')) || 24, h = dock.offsetHeight + gap;
  root.style.paddingBottom = h + 'px'; document.documentElement.style.setProperty('--dock-clear', h + 'px');
}
addEventListener('resize', () => { if ($('pubRoot')) refresh(); });
