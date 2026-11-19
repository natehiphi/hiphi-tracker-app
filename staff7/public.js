// Staff7's public mode, one bill (R-398 part 1b; the settled design, sections 3, 5 and 10). The page at #/public/<bill number>: frame.js draws it with no app bar
// and no left column, in public mode (tokens.css), and "Leave public mode" goes back to the place the person came from. The rules (who may change a bill's public
// words, the bar, a waiting change, taking down) are the data layer's, reached through public_data.js; every word on the page is public_data.js's.
// Typed words are kept as this person's draft on every change, so nothing typed is lost. The main button shows its toast at once and sends only after 10 seconds,
// unless Undo is pressed (design 3.6); leaving the page does not cancel it.
import { S, advocate, isLiveBill, pubPoints, heldFor, waitingPosition, publicPositionPending, hstToday, savePractice } from '../staff6/data.js';
import { hearingAhead } from '../staff6/model.js';
import { testimonyDue } from './bill_words.js';
import { billName, billNo } from './steps.js';
import { ic } from './icons7.js';
import { esc, btn, toast } from './parts.js';
import { bar, needsWords, barMet, sendPublicWords, discardDraftWords, draftWords, saveDraftWords, takeBackChange, takeDownWords, takeDownAsk, WAIT_ON_BILL,
  NOT_TRACKED, BAND, LEAVE_PUBLIC, LEAVE_SHORT, BACK_HOME, NO_BILL, PREVIEW_HEAD, PREVIEW_TAG, NOT_ON_SITE_YET, SAVE_LATER, SAVED_FOR_TEAM, DISCARD, DISCARD_TOAST,
  TAKE_WORDS_DOWN, TAKE_WORDS_DOWN_HELP, WORDS_DOWN_TOAST, TAKE_ASK_DOWN, ASK_DOWN_TOAST, SHOW_ASK_THROUGH, ASK_THROUGH_HELP, ASK_LABEL, ASK_FIELD, ASK_HELP,
  ASK_EXPIRED, ASK_HEARING_LATE, NICKNAME_LABEL, NICKNAME_HELP, NICK_SHORT, SUMMARY_LABEL, SUMMARY_HELP, POINTS_LABEL, POINTS_HELP, ADD_POINT, REMOVE_POINT,
  pointLabel, charsLeft, CHANGE_ON_BILL, TAKE_BACK_BUTTON, SEE_PREVIEW, FOLD_BUTTON, foldLead, pubPositionWords, hearingLine, barRefusal, MONITOR_LINE, BAR_LABEL,
  nowLine, waitingLine, sentBackLine, TAKEN_BACK_HELP, publicPositionLine, dockLine, sendLabel, adminFirst, sentToast, WORDS_ON_SITE_TOAST, SENT_ON_SITE, NOTHING_TO_SEND,
  AFTER_APPROVE, WAITING_FOR_YOU, OPEN_IT, OPEN_CHANGE_LINE } from './public_data.js';

const TEN = 10000, MAX_POINTS = 5, LIMIT = { nickname: 40, public_summary: 280, public_action: 280, point: 200 };
const WORDS = ['nickname', 'public_summary', 'talking_points', 'public_action', 'public_action_until'];
const TEXT = ['nickname', 'public_summary', 'public_action', 'public_action_until'];
const enc = encodeURIComponent, $ = id => document.getElementById(id);
const normNo = s => String(s ?? '').replace(/\s/g, '').toUpperCase();
const firstName = id => { const a = id ? advocate(id) : null; return (a?.full_name || '').split(' ')[0] || 'someone'; };
const ymd = t => new Date(t).toLocaleDateString('en-CA', { timeZone: 'Pacific/Honolulu' });   // the Honolulu day, YYYY-MM-DD, as the date field keeps it

// What the public site holds for the bill now, in the form's shape.
const publicWords = b => ({ nickname: b.nickname ?? '', public_summary: b.public_summary ?? '', talking_points: pubPoints(b), public_action: b.public_action ?? '', public_action_until: b.public_action_until ?? '' });
// A words state with every key present: null and missing both mean empty. `over` is a draft or a waiting change; only its own keys count.
const words = (base, over) => {
  const o = { ...base };
  for (const k of WORDS) if (over && over[k] !== undefined) o[k] = over[k];
  for (const k of TEXT) o[k] = String(o[k] ?? '');
  o.talking_points = (Array.isArray(o.talking_points) ? o.talking_points : []).map(x => String(x ?? ''));
  return o;
};
// The words as they would publish: trimmed, blank points left out. This is what is compared, counted for the bar and sent.
const cleanOf = f => ({ nickname: String(f.nickname ?? '').trim(), public_summary: String(f.public_summary ?? '').trim(), talking_points: f.talking_points.map(x => String(x ?? '').trim()).filter(Boolean),
  public_action: String(f.public_action ?? '').trim(), public_action_until: String(f.public_action_until ?? '').trim() });

let view = null, pending = null;   // view: the page as it is drawn (route id, bill, the form's fields, what it opened with); pending: the 10-second send

// The latest change of a bill's that Nate sent back: its words or its position (fix 2).
const waitingSentBack = id => (S.publicChanges || []).filter(x => (x.kind === 'bill' || x.kind === 'position') && x.target_id === id && x.status === 'sent_back').sort((a, b) => String(b.decided_at).localeCompare(String(a.decided_at)))[0] || null;
// The page's state for one bill, read fresh from the data: a waiting change by someone else makes the page read-only (design 10.2).
function openView(id, { unfolded = true, arrival = false, back = '' } = {}) {
  const me = S.me, B0 = S.bills.find(x => normNo(x.bill_number) === normNo(id)) || null;
  const v = { id, back, unfolded, arrival, bill: null, gone: !!B0, name: '', readOnly: false, other: '', mine: null, posMine: null, awaiting: null, sentBack: null, saved: null, fields: null };
  if (!B0 || B0.tracked === false || !me) return v;
  v.bill = B0; v.name = billName(B0);
  const w = heldFor('bill', B0.id), pw = waitingPosition(B0.id), base = words(publicWords(B0), null);
  // an admin's page for a change someone else sent says so, with its link; the admin decides it on that page (fix 7)
  if (me.is_admin && pw && pw.proposed_by !== me.id) v.awaiting = pw;
  if (w && w.proposed_by !== me.id) { v.readOnly = true; v.other = firstName(w.proposed_by); v.awaiting = me.is_admin ? w : null; v.saved = words(base, w.fields); v.fields = v.saved; return v; }
  if (w) v.mine = w;
  if (pw && pw.proposed_by === me.id) v.posMine = pw;
  if (!w && !v.posMine) { const sb = waitingSentBack(B0.id); if (sb && sb.proposed_by === me.id) v.sentBack = sb; }
  v.saved = w ? words(base, w.fields) : base;
  const draft = draftWords(B0.id);
  v.fields = draft ? words(v.saved, draft) : words(v.saved, null);
  return v;
}
const reopen = () => { const old = view; view = openView(old.id, { unfolded: old.unfolded, back: old.back }); };

// What the page works out from the form: the words as they would publish, what changed since the page opened, and what the main button and its line say.
function state() {
  const v = view, B = v.bill, CF = cleanOf(v.fields), CS = cleanOf(v.saved), M = { ...B, ...CF }, live = isLiveBill(B);
  const changed = WORDS.filter(k => JSON.stringify(CF[k]) !== JSON.stringify(CS[k]));
  // the words that are there at all: what a send of words not yet public carries (all of them, changed or not)
  const filled = WORDS.filter(k => Array.isArray(CF[k]) ? CF[k].length > 0 : CF[k] !== '');
  const nickShort = CF.nickname.length > 0 && CF.nickname.length < 3;
  // the team's position the public does not see yet, and not already sent (fix 2); a position sent by this person is shown as waiting
  const posWait = waitingPosition(B.id), posPend = publicPositionPending(B) && !posWait, sentPos = !!posWait && posWait.proposed_by === S.me?.id;
  // Public words go once something changed; words not yet public go whenever the bar is met, changed or not, but not again while our words change waits (fix 5)
  const sendKeys = live || v.mine ? changed : filled;
  const keys = posPend ? [...sendKeys, 'position'] : sendKeys;
  const canSend = !v.readOnly && !pending && !nickShort && barMet(M) && (changed.length > 0 || (!live && !v.mine && filled.length > 0) || posPend);
  let line;
  if (v.readOnly) line = v.awaiting ? OPEN_CHANGE_LINE : WAIT_ON_BILL(v.other);
  else if (nickShort) line = NICK_SHORT;
  else line = dockLine({ me: S.me, b: M, changedKeys: keys, sent: !!v.mine || sentPos })
    || (live && !S.me?.is_admin ? SENT_ON_SITE : NOTHING_TO_SEND);   // the line is never blank
  const second = v.readOnly ? '' : !live ? SAVE_LATER : changed.length ? DISCARD : '';
  return { M, CF, CS, live, changed, nickShort, canSend, line, second };
}
// The preview's tag: "After you approve" for a change of someone else's, else "Not on the public site yet" when what it shows is not what the public sees (fix 7, design 3.3).
function previewTag(s) {
  const v = view, B = v.bill, pub = cleanOf(publicWords(B));
  if (v.awaiting) return AFTER_APPROVE;
  const wordsDiffer = WORDS.some(k => JSON.stringify(s.CF[k]) !== JSON.stringify(pub[k])), posDiffer = isLiveBill(B) && (B.position ?? null) !== (B.public_position ?? null);
  return !isLiveBill(B) || wordsDiffer || posDiffer ? NOT_ON_SITE_YET : '';
}

// ---------------------------------------------------------------------------------- the page
export function publicBillPage({ id, q, back = '' }) {
  view = openView(id, { unfolded: q.get('ask') !== '1', arrival: q.get('ask') === '1', back });
  return { html: pageHTML(), bind: () => { attach(); refresh(); arrive(); } };
}

function pageHTML() {
  const v = view, B = v.bill;
  const leave = v.back || (B ? `#/bill/${enc(normNo(B.bill_number))}` : '#/');
  const band = `<header class="pub-band"><div class="pub-wrap"><p class="pub-band-words"><b>${esc(BAND)}</b>${B ? `<span class="pub-band-bill">${esc(billNo(B))} · ${esc(v.name)}</span>` : ''}</p>`
    + `<a class="btn quiet" href="${esc(leave)}"><span class="pub-long">${esc(LEAVE_PUBLIC)}</span><span class="pub-short">${esc(LEAVE_SHORT)}</span></a></div></header>`;
  if (!B) return `<div class="pub" id="pubRoot">${band}<div class="pub-wrap pub-empty"><h1 id="pubH1" tabindex="-1">${esc(v.gone ? NOT_TRACKED : NO_BILL)}</h1><p><a class="pub-link" href="#/">${esc(BACK_HOME)}</a></p></div></div>`;
  return `<div class="pub" id="pubRoot">${band}<div class="pub-wrap pub-grid">${formHTML()}`
    + `<section class="pub-side"><h2 class="pub-pv-h">${esc(PREVIEW_HEAD)}</h2><div class="pub-card" id="pubCard" tabindex="0" role="region" aria-label="${esc(PREVIEW_HEAD)}"></div></section></div>`
    + `<footer class="pub-dock" id="pubDock"><div class="pub-wrap" id="pubDockIn"></div></footer></div>`;
}

function formHTML() {
  const v = view, B = v.bill, F = v.fields, s = state(), M = s.M, ro = v.readOnly ? ' readonly' : '';
  const chg = k => s.changed.includes(k) ? ' pub-chg' : '';
  const h = hearingAhead(B), hd = h ? hearingLine(h.scheduled_at, new Date(testimonyDue(h)).toISOString()) : '';
  const nick = `<div class="pub-f"><label class="pub-lab" for="pNick">${esc(NICKNAME_LABEL)}</label><p class="pub-help" id="pNickH">${esc(NICKNAME_HELP)}</p>`
    + `<input id="pNick" class="pub-in${chg('nickname')}" type="text" maxlength="${LIMIT.nickname}" value="${esc(F.nickname)}" aria-describedby="pNickH cNick wNick"${ro}>`
    + `<p class="pub-warn" id="wNick" hidden></p><p class="pub-count" id="cNick" hidden></p></div>`;
  const sum = `<div class="pub-f"><label class="pub-lab" for="pSum">${esc(SUMMARY_LABEL)}</label><p class="pub-help" id="pSumH">${esc(SUMMARY_HELP)}</p>`
    + `<textarea id="pSum" class="pub-in${chg('public_summary')}" rows="3" maxlength="${LIMIT.public_summary}" aria-describedby="pSumH cSum"${ro}>${esc(F.public_summary)}</textarea><p class="pub-count" id="cSum" hidden></p></div>`;
  const side = needsWords(M);
  const pointBoxes = F.talking_points.map((p, i) => `<div class="pub-pt"><label class="pub-lab" for="pPt${i}">${esc(pointLabel(i + 1))}</label>`
    + `<textarea id="pPt${i}" class="pub-in${ptChg(i)}" data-pt="${i}" rows="2" maxlength="${LIMIT.point}" aria-describedby="cPt${i}"${ro}>${esc(p)}</textarea><p class="pub-count" id="cPt${i}" hidden></p>`
    + (v.readOnly ? '' : `<div class="pub-ptfoot"><button type="button" class="btn text" data-rm="${i}" aria-label="${esc(REMOVE_POINT)} ${i + 1}">${esc(REMOVE_POINT)}</button></div>`) + `</div>`).join('');
  const addBtn = !v.readOnly && F.talking_points.length < MAX_POINTS ? `<div class="pub-ptfoot">${btn(ADD_POINT, { kind: 'quiet', id: 'pubAddPt' })}</div>` : '';
  const ptsPart = side ? `<div class="pub-f" role="group" aria-labelledby="pubPtsLab"><p class="pub-lab" id="pubPtsLab">${esc(POINTS_LABEL)}</p><p class="pub-help" id="pubPtsH">${esc(POINTS_HELP)}</p>${pointBoxes}${addBtn}</div>` : '';
  const bars = `<div class="pub-f" id="pubBarBox"></div>`;
  const fields = `<div class="pub-fields" id="pubFields"${v.unfolded ? '' : ' hidden'}>${nick}${sum}${ptsPart}${bars}</div>`;
  const fold = `<div class="pub-fold"${v.unfolded ? ' hidden' : ''}><p>${esc(foldLead(M))} · <button type="button" class="btn text" id="pubUnfold" aria-expanded="false" aria-controls="pubFields">${esc(FOLD_BUTTON)}</button></p></div>`;
  const ask = `<div class="pub-f pub-ask">${hd ? `<p class="pub-hear">${esc(hd)}</p>` : ''}`
    + `<label class="pub-lab" for="pAsk">${esc(ASK_FIELD)}</label><p class="pub-help" id="pAskH">${esc(ASK_HELP)}</p>`
    + `<textarea id="pAsk" class="pub-in${chg('public_action')}" rows="2" maxlength="${LIMIT.public_action}" aria-describedby="pAskH cAsk"${ro}>${esc(F.public_action)}</textarea><p class="pub-count" id="cAsk" hidden></p>`
    + `<div class="pub-until"><label class="pub-lab" for="pUntil">${esc(SHOW_ASK_THROUGH)}</label><p class="pub-help" id="pUntilH">${esc(ASK_THROUGH_HELP)}</p>`
    + `<input id="pUntil" class="pub-in pub-date${chg('public_action_until')}" type="date" value="${esc(F.public_action_until)}" aria-describedby="pUntilH wUntil"${ro}><p class="pub-warn" id="wUntil" hidden></p></div>`
    + (s.live && B.public_action ? `<div class="pub-f">${btn(TAKE_ASK_DOWN, { kind: 'quiet', id: 'pubAskDown' })}</div>` : '') + `</div>`;
  const down = s.live ? `<div class="pub-f pub-down">${btn(TAKE_WORDS_DOWN, { kind: 'quiet', id: 'pubDown' })}<p class="pub-help">${esc(TAKE_WORDS_DOWN_HELP)}</p></div>` : '';
  const st = [`<p class="pub-st1">${esc(nowLine(B))}</p>`];
  if (v.awaiting) st.push(`<p class="pub-st2"><span>${esc(WAITING_FOR_YOU)} · <a class="pub-link" href="#/public/change/${enc(v.awaiting.id)}">${esc(OPEN_IT)}</a></span></p>`);
  else if (v.readOnly) st.push(`<p class="pub-st2">${esc(WAIT_ON_BILL(v.other))}</p>`);
  else {
    if (v.mine) st.push(`<p class="pub-st2"><span>${esc(waitingLine(v.mine))}</span>${btn(TAKE_BACK_BUTTON, { kind: 'quiet', id: 'pubTake' })}</p>`);
    if (v.posMine) st.push(`<p class="pub-st2"><span>${esc(waitingLine(v.posMine))}</span></p>`);
    if (v.sentBack) st.push(`<p class="pub-st2">${ic('undo-2')}<span>${esc(sentBackLine(v.sentBack))}</span></p>`);
  }
  const status = `<div class="pub-status" role="status" id="pubStatus">${st.join('')}</div>`;
  const pos = `<p class="pub-pos"><span>${esc(publicPositionLine(B))}</span><a class="pub-link" href="#/bill/${enc(normNo(B.bill_number))}">${esc(CHANGE_ON_BILL)}</a></p>`;
  return `<section class="pub-form"><p class="pub-num">${esc(billNo(B))}</p><h1 id="pubH1" tabindex="-1">${esc(v.name)}</h1>${pos}${status}${fold}${fields}${ask}${down}</section>`;
}
const ptChg = i => { const v = view; return String(v.fields.talking_points[i] ?? '').trim() !== String(v.saved.talking_points[i] ?? '').trim() ? ' pub-chg' : ''; };

// The three things a side bill needs, as a tick list, or the Monitor line (design 5).
function barInner(M) {
  if (!needsWords(M)) return `<p class="pub-help">${esc(MONITOR_LINE)}</p>`;
  return `<p class="pub-lab" id="pubBarLab">${esc(BAR_LABEL)}</p><ul class="pub-ticks" aria-labelledby="pubBarLab">`
    + bar(M).list.map(x => `<li class="${x.done ? 'is-done' : 'is-todo'}"><span class="pub-tick" aria-hidden="true">${ic(x.done ? 'check' : 'circle')}</span><span>${esc(x.label)}</span><span class="sr">${x.done ? ' (done)' : ' (not yet)'}</span></li>`).join('') + `</ul>`;
}

// The preview: a picture of the public page, from the words as they are written now (design 3.3).
function previewInner(M, tag) {
  const B = view.bill, pos = pubPositionWords(M.position), pts = M.talking_points.filter(Boolean);
  return `<div class="pv-head"><span>${esc(billNo(B))}</span><span class="pv-label">${esc(PREVIEW_TAG)}</span></div>`
    + (tag ? `<p class="pv-tag">${esc(tag)}</p>` : '')
    + `<h3 class="pv-title">${esc(M.nickname || billName(B))}</h3>`
    + (pos ? `<p class="pv-pos">${esc(pos)}</p>` : '')
    + (M.public_summary ? `<p class="pv-sum">${esc(M.public_summary)}</p>` : '')
    + (M.public_action ? `<p class="pv-ask"><b>${esc(ASK_LABEL)}</b> ${esc(M.public_action)}</p>` : '')
    + (pts.length ? `<div class="pv-tp"><h4>${esc(POINTS_LABEL)}</h4><ul>${pts.map(p => `<li>${esc(p)}</li>`).join('')}</ul></div>` : '');
}

// The bottom row: the main button (switched off until something changed and the bar is met), the second button, and the line that says what the press does.
function dockInner(s) {
  const go = `<button type="button" class="btn filled pub-go${s.canSend ? '' : ' off'}" id="pubGo" aria-disabled="${s.canSend ? 'false' : 'true'}">${esc(sendLabel(S.me))}</button>`;
  const second = s.second ? btn(s.second, { kind: 'quiet', id: 'pubSecond' }) : '';
  return `${go}${second}${btn(SEE_PREVIEW, { kind: 'text', id: 'pubSeePrev' })}<p class="pub-dock-line" id="pubLine" aria-live="polite">${esc(s.line)}</p>`;
}

// Every text box grows to fit its words, on load and while typing: no inner scrollbar, nothing clipped (fault 3).
function grow(el) { const border = el.offsetHeight - el.clientHeight; el.style.height = 'auto'; el.style.height = (el.scrollHeight + border) + 'px'; }
function growAll() { document.querySelectorAll('#pubRoot textarea.pub-in').forEach(grow); }
// The page's bottom clears the dock by the dock's height plus a gap, so the last control scrolls clear of it (fault 4).
function fitDock() {
  const dock = $('pubDock'), root = $('pubRoot'); if (!dock || !root) return;
  const gap = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--dock-gap')) || 24, h = dock.offsetHeight + gap;
  root.style.paddingBottom = h + 'px'; document.documentElement.style.setProperty('--dock-clear', h + 'px');
}
addEventListener('resize', () => { if ($('pubRoot')) fitDock(); });

// Redraws the parts that change as the person types: the marks, the counts, the warnings, the bar, the preview and the dock. The fields keep focus.
function refresh() {
  if (!$('pubRoot') || !view.bill) return;
  const s = state(), v = view, on = (id, c) => { const el = $(id); if (el) el.classList.toggle('pub-chg', c); };
  on('pNick', s.changed.includes('nickname')); on('pSum', s.changed.includes('public_summary')); on('pAsk', s.changed.includes('public_action')); on('pUntil', s.changed.includes('public_action_until'));
  v.fields.talking_points.forEach((p, i) => on(`pPt${i}`, ptChg(i) !== ''));
  count('cNick', v.fields.nickname.length, LIMIT.nickname); count('cSum', v.fields.public_summary.length, LIMIT.public_summary); count('cAsk', v.fields.public_action.length, LIMIT.public_action);
  v.fields.talking_points.forEach((p, i) => count(`cPt${i}`, p.length, LIMIT.point));
  warn('wNick', s.nickShort ? NICK_SHORT : ''); warn('wUntil', untilWarn());
  const nick = $('pNick'); if (nick) nick.setAttribute('aria-invalid', s.nickShort ? 'true' : 'false');
  const box = $('pubBarBox'); if (box) box.innerHTML = barInner(s.M);
  const card = $('pubCard'); if (card) card.innerHTML = previewInner(s.M, previewTag(s));
  const dock = $('pubDockIn'); if (dock) dock.innerHTML = dockInner(s);
  growAll();   // last: the changed edge (2px) is on, so each box is measured as it will be drawn
  fitDock();   // after the dock is drawn, so its height is the real one
}
// A count shows only near its limit: the last fifth of it (P-4).
function count(id, n, max) { const el = $(id); if (!el) return; const left = max - n, show = left <= Math.ceil(max * 0.2); el.hidden = !show; el.textContent = show ? charsLeft(left) : ''; }
function warn(id, msg) { const el = $(id); if (!el) return; el.textContent = msg; el.hidden = !msg; }
function untilWarn() {
  const u = view.fields.public_action_until, h = view.bill ? hearingAhead(view.bill) : null;
  if (u && u < hstToday()) return ASK_EXPIRED;
  return u && h && ymd(h.scheduled_at) > u ? ASK_HEARING_LATE : '';
}

// Redraws the whole page from the view (after a press, a take back, a take down or a discard). Focus goes to the given id, else the heading.
function paint(focusId = 'pubH1') {
  const app = $('app'); if (!app || !view) return;
  app.innerHTML = pageHTML(); attach(); refresh();
  const el = $(focusId) || $('pubH1'); if (el) el.focus({ preventScroll: !el.id.startsWith('pPt') });
}
function arrive() {
  const a = $('pAsk');
  if (view.arrival && a && !view.unfolded) { a.scrollIntoView({ block: 'center' }); a.focus({ preventScroll: true }); }
  else $('pubH1')?.focus({ preventScroll: true });
}
function attach() { const root = $('pubRoot'); if (!root) return; root.addEventListener('input', onInput); root.addEventListener('click', onClick); }

// ---------------------------------------------------------------------------------- typing (every change is kept as the draft)
function keep() { if (view.bill && !view.readOnly) saveDraftWords(view.bill.id, cleanOf(view.fields)); }
function onInput(e) {
  const t = e.target, F = view?.fields; if (!F || !view.bill || view.readOnly) return;
  if (t.id === 'pNick') F.nickname = t.value;
  else if (t.id === 'pSum') F.public_summary = t.value;
  else if (t.id === 'pAsk') {
    const was = F.public_action.trim(); F.public_action = t.value;
    const h = hearingAhead(view.bill);   // the first typed ask fills the date with the hearing's day; after that the date is the person's
    if (!was && t.value.trim() && !F.public_action_until && h) { F.public_action_until = ymd(h.scheduled_at); const u = $('pUntil'); if (u) u.value = F.public_action_until; }
  }
  else if (t.id === 'pUntil') F.public_action_until = t.value;
  else if (t.dataset.pt !== undefined) F.talking_points[+t.dataset.pt] = t.value;
  else return;
  keep(); refresh();
}

// ---------------------------------------------------------------------------------- the buttons
function onClick(e) {
  const b = e.target.closest('button'); if (!b || !view?.bill) return;
  if (b.dataset.rm !== undefined) return removePoint(+b.dataset.rm);
  const act = { pubGo: press, pubSecond: second, pubTake: takeBack, pubDown: takeDown, pubAskDown: takeAskDown, pubUnfold: unfold, pubAddPt: addPoint, pubSeePrev: seePreview }[b.id];
  if (act) act();
}
// The main button: the toast comes at once; the words go only after 10 seconds, unless Undo cancels them (design 3.6).
function press() {
  const s = state(); if (!s.canSend) return;
  const bid = view.bill.id, fields = cleanOf(view.fields);
  saveDraftWords(bid, fields);   // kept while the 10 seconds run
  const t = setTimeout(() => finish(bid, fields), TEN);
  pending = { bid, fields, t };
  toast(S.me?.is_admin ? WORDS_ON_SITE_TOAST : sentToast(adminFirst() || 'an admin'), { undo: () => { clearTimeout(t); pending = null; paint('pubGo'); }, ms: TEN });
  paint('pubGo');
}
// Sends the words now: refused in plain words, or the draft is discarded and the page drawn from the bill again.
async function finish(bid, fields) {
  if (pending && pending.bid === bid) pending = null;
  const B = S.bills.find(x => x.id === bid);
  let r;
  try { r = await sendPublicWords(bid, fields); } catch (e) { r = { refused: (e && e.message) || 'It did not go.' }; }
  if (r.refused) toast(r.refused === 'bar' ? barRefusal({ ...B, ...fields }) : r.refused, { ms: 6000 });
  else discardDraftWords(bid);
  if (view?.bill?.id === bid && $('pubRoot')) { reopen(); paint('pubGo'); }
}
function second() { const s = state(); if (s.second === DISCARD) return discard(); if (s.second === SAVE_LATER) return saveLater(); }
function saveLater() { saveDraftWords(view.bill.id, cleanOf(view.fields)); toast(SAVED_FOR_TEAM, { ms: 6000 }); refresh(); }
// Discard changes: the form goes back to what it opened with; Undo puts the draft back.
function discard() {
  const bid = view.bill.id, undo = discardDraftWords(bid);
  toast(DISCARD_TOAST, { undo: () => { undo(); reopen(); paint('pubH1'); }, ms: TEN });
  reopen(); paint('pubH1');
}
async function takeBack() {
  const w = view.mine; if (!w) return;
  let r;
  try { r = await takeBackChange(w.id); } catch (e) { r = { refused: (e && e.message) || 'It did not go.' }; }
  if (r.refused) { toast(r.refused, { ms: 6000 }); return paint('pubTake'); }
  saveDraftWords(view.bill.id, cleanOf(words(publicWords(view.bill), w.fields)));   // the words it held are kept here
  toast(TAKEN_BACK_HELP, { ms: 6000 });
  reopen(); paint('pubH1');
}
function takeDown() {
  const bid = view.bill.id, prev = cleanOf(view.fields);
  saveDraftWords(bid, prev);
  const undo = takeDownWords(bid);
  toast(WORDS_DOWN_TOAST, { undo: () => { undo(); reopen(); paint('pubH1'); }, ms: TEN });
  reopen(); paint('pubH1');
}
function takeAskDown() {
  const bid = view.bill.id, prev = cleanOf(view.fields), undo = takeDownAsk(bid);
  view.fields.public_action = ''; view.fields.public_action_until = ''; saveDraftWords(bid, cleanOf(view.fields));
  toast(ASK_DOWN_TOAST, { undo: () => { undo(); saveDraftWords(bid, prev); reopen(); paint('pAsk'); }, ms: TEN });
  reopen(); paint('pubH1');
}
function unfold() { view.unfolded = true; paint('pNick'); }
function addPoint() { const F = view.fields; if (F.talking_points.length >= MAX_POINTS) return; F.talking_points.push(''); paint(`pPt${F.talking_points.length - 1}`); }
function removePoint(i) { view.fields.talking_points.splice(i, 1); keep(); paint(i > 0 ? `pPt${i - 1}` : 'pubAddPt'); }
function seePreview() { const c = $('pubCard'); if (c) { c.scrollIntoView({ block: 'start' }); c.focus({ preventScroll: true }); } }

// A press still counting down when the page is left is sent now, so leaving never cancels it (design 3.6).
addEventListener('pagehide', () => { if (!pending) return; const p = pending; clearTimeout(p.t); pending = null; finish(p.bid, p.fields); savePractice(); });
