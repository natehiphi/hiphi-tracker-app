// Review mode (#/review, #/review/:id): one approval per screen, a counter, and it moves to the next one on its own (pro
// P1). Opened from Testimony › To approve (spec 3.3, F42), from a row's Review, "g r" and the search's "approve". Testimony
// drafts waiting for me (first approval for admins and approvers, the second look for second approvers, a stand-in's
// approval in the last hours), then supporter emails someone else wrote. The buttons call the same DB.transition /
// DB.alertStep as before; the toast is written from the state the server hands back and says who is next (P2).
// Behaviour unchanged in v6 (spec 6: "Review mode is unchanged in behaviour, restyled"): Approve waits a second before it
// works and has Undo, Shift+A approves, a send-back needs a note and is held ten seconds, Skip, Open Doc, auto-advance
// (P1-P3: approve 2 taps, send back 3). Restyled to the v6 look (spec 4) and the v6 words (spec 5): the five state words
// ("Second look", never "second approval"), the one time to act (steps.js actBy: "Approve by today 11:00 AM"), committees
// and drafts in words, the bill's number after its name (D15). Each card still shows the bill as it stands (R-022): who
// owns it and its position, and a plain warning when it is dead, only monitored or has no hearing, so nobody approves an
// email asking supporters to testify on a bill that died. The draft itself stays in its Google Doc (Nate, 9/19).
// The queue is worked out here (it was today.js's reviewQueue), so Review and Testimony › To approve count the same items.
import { S, DB, esc, hooks, startedFromLine, raceLine } from './data.js';
import { agoWords, alertTarget, alertsToReview, billById, diedish, whyDead, hearingAhead, stopOf, approves, canFirstApprove, canSecondApprove, standingIn, draftHearing } from './model.js';
import { teamFirst, newOwnerTag, staleLine, filerOf, roomName, whenAt } from './model.js';
import { icon, btn, notice, toast, openSheet, closeSheet, confirmSheet, keysOn, keysUsed, posIcons, POS_WORD, ownerOf, docBtn } from './ui.js';
import { emailPreview } from './composer.js';
import { billStep, shownStatus, statusTile, whereWords, committeeName, numWords, nameWords, whoseStep, nw, sayWords } from './steps.js';
import { plainCodes } from './terms.js';

const DAY = 864e5;
const first = id => teamFirst(id);   // "Lauren (turned off)" for someone turned off (R-316 W28); "Someone" for nobody
const ago = iso => agoWords(iso);
const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
const typing = t => t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
const HOVER = () => { try { return matchMedia('(hover: hover) and (pointer: fine)').matches; } catch { return false; } };
// ui.js closes a sheet with history.back(), which lands a moment later: a step taken right after waits for it, so the
// address and the screen never part (it was today.js's afterBack).
const afterBack = () => !history.state?.sheet ? Promise.resolve() : new Promise(res => { let done = false; const f = () => { if (done) return; done = true; removeEventListener('popstate', f); setTimeout(res, 0); }; addEventListener('popstate', f); setTimeout(f, 500); });

// ---- the queue ----
// Written testimony is due 24 hours before the hearing unless the notice says otherwise (Hawaiʻi rule).
const testDue = h => h && h.status !== 'cancelled' ? new Date(h.testimony_deadline || new Date(h.scheduled_at).getTime() - DAY).getTime() : null;
// A draft whose sitting ended more than two days ago is past helping; one whose sitting was cancelled stays while the bill
// can still be heard (R-316 W24).
const pastHelp = (h, b) => h?.status === 'cancelled' ? diedish(b) || !!stopOf(b).deadline?.missed : !!h && new Date(h.scheduled_at).getTime() < Date.now() - 2 * DAY;
// queue(): every draft waiting for my approval (soonest due first), then supporter emails, never my own. `only`
// 'testimony' leaves the emails out: Testimony › To approve's Start review reviews what that tab counts, and the emails
// keep their own door there, the line to Outreach › Emails (fresh-eyes review 23 Oct: "1 waits" became "1 of 2").
export function queue({ only = '' } = {}) {
  const me = S.me || {}, out = [];
  for (const d of Object.values(S.drafts || {}).flat()) {
    if (!['review', 'second_review'].includes(d.status)) continue;
    const h = draftHearing(d);
    if (!((d.status === 'review' && canFirstApprove(me, d, h)) || (d.status === 'second_review' && canSecondApprove(me, d)))) continue;
    const b = billById(d.bill_id); if (!b || pastHelp(h, b)) continue;
    out.push({ type: 'draft', key: String(d.id), d, b, h, due: testDue(h) });
  }
  out.sort((x, y) => (x.due ?? Infinity) - (y.due ?? Infinity) || (x.b.priority || 9) - (y.b.priority || 9) || x.b.bill_number.localeCompare(y.b.bill_number, 'en', { numeric: true }));
  if (only !== 'testimony') for (const a of alertsToReview()) out.push({ type: 'email', key: 'email-' + a.id, a, b: a.bill_id ? billById(a.bill_id) : null, due: null });
  return out;
}

// The session: the queue as it stood when review started, so "2 of 3" stays true while items leave the live queue.
function session(route) {
  let r = S.tdRev; const only = route.q?.only === 'testimony' ? 'testimony' : '';
  // A fresh start (#/review, #/review?only=testimony) after the last session ended, or asking for a different queue.
  if (!r || (!route.id && (r.done || (r.only || '') !== only))) {
    const q = queue({ only }).map(x => x.key);
    // Opened on one item (a row's Review button): that item first, then the rest of the queue.
    if (route.id && route.id !== 'done' && q.includes(route.id)) q.unshift(...q.splice(q.indexOf(route.id), 1));
    r = S.tdRev = { keys: q, i: 0, log: [], skipped: [], done: false, only };
  }
  if (route.id && route.id !== 'done') {
    const at = r.keys.indexOf(route.id);
    if (at >= 0) r.i = at;
    else if (resolve(route.id)) { r.keys.splice(r.i, 0, route.id); }   // a link to one item that is not in my queue: show it, in place
  }
  return r;
}
// key -> the record it stands for, read fresh each time (the draft object changes after a transition).
function resolve(key) {
  if (!key) return null;
  if (key.startsWith('email-')) { const a = (S.alerts || []).find(x => String(x.id) === key.slice(6)); return a ? { type: 'email', key, a, b: a.bill_id ? billById(a.bill_id) : null } : null; }
  const d = Object.values(S.drafts || {}).flat().find(x => String(x.id) === key); if (!d) return null;
  const b = billById(d.bill_id), h = draftHearing(d); return b ? { type: 'draft', key, d, b, h, due: testDue(h) } : null;
}
// Still mine to decide? (Someone else may have acted, or it was a link to a draft past this step.)
const actionable = it => it.type === 'email' ? it.a.status === 'submitted' && approves(S.me) && it.a.author_id !== S.me?.id
  : (it.d.status === 'review' && canFirstApprove(S.me, it.d, it.h)) || (it.d.status === 'second_review' && canSecondApprove(S.me, it.d));

// ---- the bill as it stands ----
// Its position and owner in one quiet line. A bill that is dead, only monitored, or has no hearing to testify at gets a
// warning instead, in words (no codes), so nothing is said twice (A-14).
function factsLine(b) {
  const own = ownerOf(b), p = b.position || '';
  const bits = [b.position !== 'monitor' ? `${posIcons(p)}<span>${esc(POS_WORD[p] || 'No position')}</span>` : '',
    `<span>${esc(own ? (own.id === S.me?.id ? 'You own it' : `${first(own.id)} owns it${newOwnerTag(own)}`) : 'No owner yet')}</span>`].filter(Boolean);
  return `<p class="rv6-line rv6-facts">${bits.join('<span class="rv6-dot" aria-hidden="true">·</span>')}</p>`;
}
function billState(b, { email = false, h = null } = {}) {
  if (diedish(b)) return notice('info', 'circle-x', `<b>This bill did not advance.</b> ${whyDead(b)} ${email ? 'This email would ask people to act on a bill that can no longer move.' : 'Testimony on it can no longer help.'}`);
  const monitor = b.position === 'monitor';
  const noHearing = email ? stopOf(b).phase === 'committee' && !hearingAhead(b) : !h;
  const head = noHearing && monitor ? 'No hearing is set, and HIPHI only monitors this bill.' : noHearing ? 'No hearing is set.' : monitor ? 'HIPHI only monitors this bill.' : '';
  if (!head) return email ? `<p class="rv6-line">${icon('route')}<span>${nw(esc(whereWords(b)))}</span></p>` : '';
  const why = monitor ? ` It has no position ${email ? 'for supporters to back' : 'to testify for'}.` : '';
  const then = noHearing && email ? ' If this email asks people to testify, there is nothing to testify at yet.' : '';
  return notice('info', noHearing ? 'calendar' : 'eye', `<b>${head}</b>${why} ${esc(whereWords(b))}.${then}`);
}
// The Write -> Approve -> Second look -> File track, as the step card draws it (a quiet line, not tabs: V35).
function track(d) {
  const second = d.status === 'second_review' || !!d.second_approved_by || !!d.first_for_bill
    || (d.status === 'review' && !Object.values(S.drafts || {}).flat().some(x => x.bill_id === d.bill_id && x.id !== d.id && (['approved', 'filed'].includes(x.status) || x.second_approved_at)));
  const steps = [['draft', 'Write'], ['review', 'Approve'], ...(second ? [['second_review', 'Second look']] : []), ['approved', 'File']];
  const cur = Math.max(0, steps.findIndex(([k]) => k === d.status));
  return `<ol class="v6-track rv6-track" aria-label="Testimony steps">${steps.map(([, l], i) => `<li class="${i < cur ? 'done' : i === cur ? 'cur' : ''}"${i === cur ? ' aria-current="step"' : ''}>${i < cur ? icon('check') : '<span class="v6-track-dot" aria-hidden="true"></span>'}<span>${esc(l)}</span></li>`).join('')}</ol>`;
}
function header(r, total) {
  const n = Math.min(r.i + 1, total);
  return `<div class="rv6-bar sv-phead">
    <a class="iconbtn rv6-x" href="#/testimony?view=approve" data-back aria-label="Close review" title="Close review">${icon('x')}</a>
    <h1 class="rv6-h"><span class="rv6-hw">Review</span> <span class="rv6-n"><span class="rv6-hd" aria-hidden="true">· </span>${n} of ${total}</span></h1>
    ${btn('Skip', { kind: 'text', iconEnd: 'chevron-right', attrs: { 'data-rvskip': '1' } })}</div>`;
}
const head = b => `<span class="rv6-name">${esc(nameWords(b, 120))}</span> <span class="rv6-num">${esc(numWords(b))}</span>`;
function draftBody(it) {
  const { d, b, h } = it, me = S.me || {}, own = d.submitted_by && d.submitted_by === me.id, two = d.status === 'second_review';
  // The one time to act (spec 5 actBy), or "Late, still accepted until 9:30 AM" in amber while the Capitol still takes it.
  const s = billStep(b, { d, h }), shown = s ? shownStatus({ ...s, mine: true }) : null;
  const tile = !s ? null : ['late', 'overdue'].includes(shown.tone) ? shown : s.act?.words ? { tone: 'neutral', icon: s.status.soon ? 'clock' : 'calendar', words: s.act.words } : null;
  const who = two ? `${cap(first(d.approved_by))} approved it ${ago(d.approved_at)}. It is this bill’s first testimony, so it gets a second look.`
    : d.submitted_by ? `Sent by ${own ? 'you' : first(d.submitted_by)} ${ago(d.submitted_at)}` : 'Not sent by anyone yet';
  const late = staleLine(b, d), from = late && d.from_draft_id ? '' : startedFromLine(b, d);
  const hear = h ? `${committeeName(h.committee) || h.committee} · ${h.status === 'cancelled' ? 'hearing cancelled, no new date yet' : `${whenAt(h.scheduled_at)}${h.room ? ` · ${roomName(h.room)}` : ''}`}` : '';
  const f = filerOf(d), filer = !f ? '' : f === me.id ? 'You file it once it is approved.' : `${cap(first(f))} files it once it is approved.`;
  return `<article class="rv6-card" aria-labelledby="rv6-b">
    <p class="rv6-eb">${icon(two ? 'badge-check' : 'file-text')}<span>${two ? 'Second look' : own ? 'Your own testimony' : 'Testimony'}</span></p>
    <h2 id="rv6-b" class="rv6-title">${head(b)}</h2>
    ${tile ? `<p class="rv6-when">${statusTile(tile)}</p>` : ''}
    ${hear ? `<p class="rv6-line">${icon('landmark')}<span>${nw(esc(hear))}</span></p>` : ''}
    ${factsLine(b)}
    ${billState(b, { h })}
    <p class="rv6-line">${icon('user-round')}<span>${esc(who)}</span></p>
    ${from ? `<p class="rv6-line">${icon('copy')}<span>${plainCodes(esc(from))}</span></p>` : ''}
    ${late ? notice('info', 'triangle-alert', plainCodes(esc(late))) : ''}
    ${d.review_note ? `<blockquote class="rv6-note"><span class="rv6-nl">The earlier note</span>${esc(d.review_note)}</blockquote>` : ''}
    ${track(d)}
    ${filer ? `<p class="rv6-line rv6-filer">${esc(filer)}</p>` : ''}
    ${d.doc_url ? `<div class="rv6-doc">${docBtn(d.doc_url, { kind: 'secondary', attrs: { 'data-doc': '1' } })}</div>` : `<p class="rv6-line rv6-muted">The Google Doc link is missing. Open the bill to find it.</p>`}
  </article>`;
}
function emailBody(it) {
  const a = it.a, n = S.tdAud?.[a.id];
  return `<article class="rv6-card" aria-labelledby="rv6-b">
    <p class="rv6-eb">${icon('mail')}<span>Email to supporters</span></p>
    <h2 id="rv6-b" class="rv6-title rv6-subj">${esc(a.subject || '(no subject)')}</h2>
    ${it.b ? `<p class="rv6-bill">${head(it.b)}</p>${factsLine(it.b)}${billState(it.b, { email: true })}` : ''}
    <p class="rv6-line">${icon('users')}<span>To ${n != null ? `${n} ${n === 1 ? 'person' : 'people'} who follow` : 'the people who follow'} ${it.b ? esc(numWords(it.b)) : plainCodes(esc(alertTarget(a)))}</span></p>
    <p class="rv6-line">${icon('user-round')}<span>Sent by ${esc(first(a.author_id))} ${esc(ago(a.submitted_at || a.created_at))}</span></p>
    ${S.emailCfg?.enabled === false ? notice('info', 'mail', 'Email is paused. You can approve; an approved email is held until email is turned on.') : ''}
    <div class="rv6-mail">${emailPreview(a)}</div>
  </article>`;
}
// Skipped items that still wait for me (someone else may have decided them meanwhile).
const stillSkipped = r => r.skipped.filter(k => { const it = resolve(k); return it && actionable(it); });
function endScreen(r) {
  const decided = r.log.length, skipped = stillSkipped(r);
  const title = !r.keys.length ? 'Nothing waits for your approval.' : !decided ? 'Nothing reviewed yet.' : skipped.length ? `${decided} of ${r.keys.length} reviewed.` : r.keys.length === 1 ? 'Reviewed. Thank you.' : `All ${decided} reviewed. Thank you.`;
  const text = !r.keys.length ? 'Testimony and supporter emails that need you show up here.' : '';
  return `<div class="rv6 rv6-end"><div class="sv-phead"><h1 class="sv-h1 rv6-h">Review</h1></div>
    <div class="rv6-done"><p class="rv6-dt">${icon('circle-check')}<span>${esc(title)}</span></p>${text ? `<p class="rv6-dx">${esc(text)}</p>` : ''}</div>
    ${decided ? `<ul class="rv6-log" aria-label="What you decided">${r.log.map(x => `<li><span class="rv6-li">${icon(x.icon)}</span><span><b>${esc(x.num)}</b><span class="rv6-lw">${esc(x.what)}</span></span></li>`).join('')}</ul>` : ''}
    <div class="rv6-endbtns">${skipped.length ? btn(`Review the ${skipped.length === 1 ? 'one' : skipped.length} you skipped`, { kind: 'primary', attrs: { 'data-again': '1' } }) : ''}${btn('Back to Testimony', { kind: skipped.length ? 'secondary' : 'primary', href: '#/testimony?view=approve', attrs: { 'data-home': '1' } })}</div></div>`;
}

function current(route) {
  const r = session(route);
  while (r.i < r.keys.length && !resolve(r.keys[r.i])) r.keys.splice(r.i, 1);   // gone (deleted or reloaded): drop it
  // The end screen only after something happened; a reload of #/review/done starts the queue again.
  const end = route.id === 'done' && (r.log.length || r.skipped.length);
  return { r, it: !end && r.i < r.keys.length ? resolve(r.keys[r.i]) : null };
}
// The draft's place for "no longer waiting for you", in the state words (spec 5).
const STATE_SAID = { draft: 'back with its writer', review: 'with an approver', second_review: 'waiting for its second look', approved: 'ready to file', filed: 'filed', cancelled: 'for a cancelled hearing' };
function render(route) {
  if (!S.me) return `<div class="rv6"><p>No staff record yet. Ask your admin to add you.</p></div>`;
  const { r, it } = current(route);
  if (!it) { r.done = true; return endScreen(r); }
  if (it.type === 'email') { S.tdAud ??= {}; const a = it.a; if (S.tdAud[a.id] === undefined) { S.tdAud[a.id] = null; DB.alertAudience(a.bill_id, a.list_id, a.segment_id).then(n => { S.tdAud[a.id] = n; if (S.route?.name === 'review') hooks.render(); }).catch(() => {}); } }
  const mine = actionable(it);
  // A second approver standing in names who they stand in for (F44).
  const stand = mine && it.type === 'draft' && it.d.status === 'review' && standingIn(S.me, it.h);
  const standFor = stand ? whoseStep(it.d, it.b, { h: it.h }).ids.filter(id => id !== S.me.id && (S.advocates || []).some(a => a.id === id && (a.is_admin || a.can_approve))).map(id => first(id)) : [];
  return `<div class="rv6">${header(r, r.keys.length)}
    ${stand ? notice('info', 'clock', `<b>You are standing in${standFor.length ? ` for ${esc(standFor.length > 1 ? `${standFor.slice(0, -1).join(', ')} or ${standFor[standFor.length - 1]}` : standFor[0])}` : ''}.</b> Nobody has given the first approval yet and testimony is due soon, so you can approve it or send it back.`) : ''}
    ${mine ? '' : notice('info', 'info', it.type === 'email' ? 'This email is no longer waiting for your approval.' : `This testimony is no longer waiting for you. It is ${esc(STATE_SAID[it.d.status] || it.d.status)}.`)}
    ${it.type === 'email' ? emailBody(it) : draftBody(it)}
    ${keysOn() && keysUsed() ? `<p class="rv6-keys">Keys: Shift+A approve · R send back${it.type === 'draft' ? ' · O open the Doc' : ''} · Right arrow skip · Esc close</p>` : ''}</div>`;
}
function bar(route) {
  const { it } = current(route);
  if (!it) return '';
  if (!actionable(it)) return btn('Next', { attrs: { 'data-rvskip': '1' }, iconEnd: 'chevron-right' });
  return `${btn('Send back', { kind: 'secondary', icon: 'undo-2', attrs: { 'data-changes': '1' } })}${btn('Approve', { icon: 'check', attrs: { 'data-approve': '1' } })}`;
}

// Moving on: record the decision, then load the next item in place (replaceState, so Back leaves review).
function advance(r, entry) {
  if (entry) r.log.push(entry); else if (!r.skipped.includes(r.keys[r.i])) r.skipped.push(r.keys[r.i]);
  r.i++;
  S.go(r.i < r.keys.length ? `#/review/${encodeURIComponent(r.keys[r.i])}` : '#/review/done', { replace: true });
}
const markNotices = billId => { const keys = (S.inbox || []).filter(i => i.direct && i.unread && i.bill_id === billId && i.kind !== 'message').map(i => i.key); if (keys.length) DB.inboxMark(keys).catch(() => {}); };
// Approve is the one step a second tap or a stray key must never reach (assessment 9/19: the next item's Approve
// appears in the same spot, and a tap 1.5 seconds later approved an email to 12 supporters unread). Three guards:
//   1. For a second after an item appears, Approve does nothing (ARM_MS; the button shows it is not ready yet).
//   2. An email to supporters asks once more, with the number of people.
//   3. Every approval has Undo for ten seconds (the server allows it for ten minutes, migration 058).
const ARM_MS = 1000;
let shown = { key: '', at: 0 };
const armed = key => shown.key === key && performance.now() - shown.at >= ARM_MS;
// Undo: the decision leaves the log, and review returns to that item.
function backTo(r, it, entry, msg) {
  const at = r.log.indexOf(entry); if (at >= 0) r.log.splice(at, 1);
  const i = r.keys.indexOf(it.key); if (i < 0) r.keys.splice(r.i = Math.min(r.i, r.keys.length), 0, it.key); else r.i = i;
  r.done = false;
  toast(msg);
  if (S.route?.name === 'review') S.go(`#/review/${encodeURIComponent(it.key)}`, { replace: true }); else hooks.render();
}
// An approval is stepped back by the server (migration 058).
async function unapprove(r, it, entry) {
  if (it.type === 'email') await DB.alertStep(it.a.id, 'unapprove'); else await DB.transition(it.b.id, it.d.id, 'unapprove');
  backTo(r, it, entry, 'Approval undone. It is waiting for you again.');
}

// ---- Send back, held for ten seconds (B-5; R-022) ----
// The database has no step that takes a send-back back: the writer is told at once, and a draft in second review would
// lose its first approval. So the send waits out the Undo instead of being reversed after it. Every screen shows the
// result at once (the item is back with its writer, the queue moves on); Undo puts it back before anyone is told; if
// the page is hidden or closed, what is waiting goes at once. The step card's Send back (steps.js) and the bill page use
// the same hold.
// holdBack({ key, target, patch, send, onFail }) -> undo(), which resolves false when it has already gone.
const HOLD_MS = 10000, held = new Map();
export function holdBack({ key, target, patch, send, onFail }) {
  const prev = Object.fromEntries(Object.keys(patch).map(k => [k, target[k] ?? null]));
  Object.assign(target, patch);                     // what the database will do, shown now
  const h = { t: 0, go: async () => {
    if (held.get(key) !== h) return;
    held.delete(key); clearTimeout(h.t);
    try { await send(); } catch (e) { Object.assign(target, prev); onFail?.(e); }
  } };
  h.t = setTimeout(h.go, HOLD_MS); held.set(key, h);
  return async () => {
    if (held.get(key) !== h) { toast('Too late to undo: it has already gone back. It can be resubmitted as it was.'); return false; }
    clearTimeout(h.t); held.delete(key); Object.assign(target, prev); return true;
  };
}
const flushHeld = () => { for (const h of [...held.values()]) h.go(); };
addEventListener('pagehide', flushHeld);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushHeld(); });
// R-316 W43: the screen still showed the buttons, but the draft had already moved on underneath (a teammate's step, read by
// the 2-minute look while this page could not redraw). Say who acted and redraw, instead of a button that does nothing.
function movedOn(it) {
  if (!it || it.type !== 'draft' || actionable(it)) return false;
  const line = raceLine(it.d); if (line) toast(line);
  hooks.render(); return true;
}
async function approve(route, el) {
  const { r, it } = current(route); if (movedOn(it) || !it || !actionable(it)) return;
  if (!armed(it.key)) return;   // too soon after this item appeared: a leftover tap, not a decision
  if (it.type === 'email') {
    const n = S.tdAud?.[it.a.id];
    const yes = await confirmSheet({ title: n != null ? `Approve this email to ${n} ${n === 1 ? 'person' : 'people'}?` : 'Approve this email to supporters?', text: `“${esc(it.a.subject || '(no subject)')}”. ${esc(first(it.a.author_id))} can send it once you approve.`, ok: 'Approve' });
    if (!yes) return;
    await afterBack();
  }
  el = document.querySelector('[data-approve]') || el;
  if (el) { el.setAttribute('aria-busy', 'true'); el.disabled = true; }
  try {
    if (it.type === 'email') {
      await DB.alertStep(it.a.id, 'approve');
      const msg = `Approved. ${first(it.a.author_id)} can send it now.`, entry = { num: it.b ? `Email on ${sayWords(it.b)}` : 'Email', what: `Approved by you · ${first(it.a.author_id)} can send it now`, icon: 'check' };
      toast(msg, { ok: true, undo: () => unapprove(r, it, entry) }); advance(r, entry);
      return;
    }
    await DB.transition(it.b.id, it.d.id, 'approve'); markNotices(it.b.id);
    // Written from the state the server returned: a first testimony goes on to its second look.
    const d = resolve(it.key)?.d || it.d, fid = filerOf(d), filer = fid && fid !== S.me.id ? first(fid) : null;   // W20 (T-3): model.js filerOf
    const next = d.status === 'second_review' ? `${cap(whoseStep(d, it.b).words) || 'A second approver'} gives the second look next` : filer && filer !== 'Someone' ? `${filer} files it next` : 'File it at the Capitol next';
    const entry = { num: sayWords(it.b), what: `Approved by you · ${next}`, icon: 'check' };
    toast(`Approved. ${next}.`, { ok: true, undo: () => unapprove(r, it, entry) }); advance(r, entry);
  } catch (e) { toast(e, { err: true }); if (el && el.isConnected) { el.removeAttribute('aria-busy'); el.disabled = false; } }
}
// Send back: a note is required, so the writer knows what to fix.
const DOC_NOTE = 'See my comments in the Doc';
function changes(route) {
  const { r, it } = current(route); if (movedOn(it) || !it || !actionable(it)) return;
  const to = first(it.type === 'email' ? it.a.author_id : it.d.submitted_by || (S.assignments[it.b.id] || [])[0]);
  const name = to === 'Someone' ? 'the writer' : to;
  openSheet({ title: 'What should change?', size: 'auto',
    body: `<div class="field"><textarea id="td-note" rows="4" aria-labelledby="sv-sh-t" aria-describedby="td-note-h" required autofocus>${esc(S.rvNotes?.[it.key] || '')}</textarea><span class="help" id="td-note-h">${esc(name === 'the writer' ? 'The writer' : name)} sees this note with the ${it.type === 'email' ? 'email' : 'testimony'}.</span></div>${it.type === 'email' ? '' : `<p class="rv-chips">${btn(DOC_NOTE, { kind: 'secondary', sm: true, icon: 'message-square', attrs: { 'data-docnote': '1' } })}</p>`}`,
    foot: btn(`Send back to ${esc(name)}`, { icon: 'undo-2', attrs: { 'data-send': '1' } }),
    wire: dlg => {
      const ta = dlg.querySelector('#td-note'), go = dlg.querySelector('[data-send]'); ta.focus();
      ta.oninput = () => { ta.removeAttribute('aria-invalid'); dlg.querySelector('#td-note-e')?.remove(); (S.rvNotes ??= {})[it.key] = ta.value; };   // kept if the sheet closes unsent (X10-6)
      // R-316 W56 (B-16): comments already left in the Google Doc are one tap; the cursor waits after it for more words.
      const dn = dlg.querySelector('[data-docnote]');
      if (dn) dn.onclick = () => { if (!ta.value.includes(DOC_NOTE)) ta.value = (DOC_NOTE + '. ' + ta.value.trim()).trim() + (ta.value.trim() ? '' : ' '); ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); ta.oninput(); };
      go.onclick = async () => {
        const note = ta.value.trim();
        if (!note) { ta.setAttribute('aria-invalid', 'true'); if (!dlg.querySelector('#td-note-e')) ta.insertAdjacentHTML('afterend', `<span class="err" id="td-note-e" role="alert">${icon('circle-alert')}Write what should change first.</span>`); ta.setAttribute('aria-describedby', 'td-note-e td-note-h'); ta.focus(); return; }
        go.setAttribute('aria-busy', 'true'); go.disabled = true;
        const num = it.type === 'email' ? (it.b ? `Email on ${sayWords(it.b)}` : 'Email') : sayWords(it.b);
        const entry = { num, what: `Back to ${name} with your note: “${note.length > 80 ? note.slice(0, 78) + '…' : note}”`, icon: 'undo-2' };
        // Held ten seconds (holdBack above): the Undo in the toast cancels it before the writer is told.
        const undo = holdBack({ key: it.key, target: it.type === 'email' ? it.a : it.d,
          patch: it.type === 'email' ? { status: 'returned', review_note: note } : { status: 'draft', review_note: note },
          send: () => (it.type === 'email' ? DB.alertStep(it.a.id, 'return', note) : DB.transition(it.b.id, it.d.id, 'request_changes', note).then(() => markNotices(it.b.id)))
            .then(() => { delete S.rvNotes[it.key]; }),
          onFail: () => { toast(`${num} was not sent back. It is still waiting for you; try again.`, { err: true }); hooks.render(); } });
        (S.rvNotes ??= {})[it.key] = note;             // an Undo brings the note back with the item
        closeSheet({ silent: true }); await afterBack();
        toast(`Sent back to ${name} with your note. ${name === 'the writer' ? 'The writer revises' : `${name} revises`} and resubmits it.`, { undo: async () => { if (await undo()) backTo(r, it, entry, 'Not sent back. It is waiting for you again, with your note.'); } });
        advance(r, entry);
      };
    } });
}
function close() { if ((history.state?.d || 0) > 0) history.back(); else S.go('#/testimony?view=approve'); }

function wire(route, root) {
  const main = root.querySelector('main'); if (!main) return;
  // data-rvskip, not data-skip: the frame's "Skip to content" button carries data-skip (R-180).
  root.querySelectorAll('[data-rvskip]').forEach(el => el.onclick = () => { const { r } = current(route); advance(r, null); });
  // A new item on screen: Approve waits a second before it listens, and says so (dimmed, aria-disabled; it keeps focus and
  // its place, so nothing jumps). The card slides in so the change of item cannot be missed (calm, 220ms; none under
  // Reduce Motion). A redraw mid-slide picks the slide up where it was instead of snapping the card in.
  const { it: now } = current(route), ap = root.querySelector('[data-approve]');
  if (now && shown.key !== now.key) shown = { key: now.key, at: performance.now() };
  const since = now ? performance.now() - shown.at : Infinity;
  if (since < 500) for (const [sel, cls] of [['.rv6-card', 'rv6-in'], ['.rv6-n', 'rv6-tick']]) {
    const el = root.querySelector(sel); if (el) { el.style.animationDelay = `-${Math.round(since)}ms`; el.classList.add(cls); }
  }
  if (ap && now && !armed(now.key)) { ap.setAttribute('aria-disabled', 'true'); ap.classList.add('rv6-arming');
    setTimeout(() => { if (ap.isConnected) { ap.removeAttribute('aria-disabled'); ap.classList.remove('rv6-arming'); } }, Math.max(0, ARM_MS - (performance.now() - shown.at)) + 20); }
  ap?.addEventListener('click', e => approve(route, e.currentTarget));
  root.querySelector('[data-changes]')?.addEventListener('click', () => changes(route));
  root.querySelector('[data-again]')?.addEventListener('click', () => { const keys = stillSkipped(S.tdRev); S.tdRev = { keys, i: 0, log: [], skipped: [], done: false, only: S.tdRev?.only || '' }; S.go(`#/review/${encodeURIComponent(keys[0])}`, { replace: true }); });
  root.querySelector('[data-home]')?.addEventListener('click', () => { S.tdRev = null; });
}

// Desktop keys, only where there is a mouse to hover: Shift+A approve, R send back (it opens a note, so a stray R decides
// nothing), O open the Doc, Right arrow skip, Esc close. My settings can switch all shortcuts off.
document.addEventListener('keydown', e => {
  if (S.route?.name !== 'review' || !HOVER() || !keysOn() || e.metaKey || e.ctrlKey || e.altKey || typing(e.target) || document.querySelector('dialog[open]')) return;
  const route = S.route, k = e.key.toLowerCase();
  if (k === 'escape') { e.preventDefault(); close(); return; }
  const { it } = current(route); if (!it) return;
  if (k === 'arrowright') { e.preventDefault(); document.querySelector('[data-rvskip]')?.click(); }
  // Approve takes Shift+A: a lone letter from a sentence meant for another window approved two items (9/19).
  else if (k === 'a' && e.shiftKey) { e.preventDefault(); document.querySelector('[data-approve]')?.click(); }
  else if (k === 'r') { e.preventDefault(); document.querySelector('[data-changes]')?.click(); }
  else if (k === 'o' && it.type === 'draft' && it.d.doc_url) { e.preventDefault(); window.open(it.d.doc_url, '_blank', 'noopener'); }
});

export default {
  tab: 'testimony', tabs: false, narrow: true,   // one decision per screen: a reading column, the buttons right under the card
  // A cold arrival (a link from Slack) goes back to Testimony › To approve, where Review is opened from (spec 3.3).
  back: () => ({ href: '#/testimony?view=approve', label: 'Testimony' }),
  title: () => 'Review',
  render, wire, bar,
};
