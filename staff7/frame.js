// Staff7's frame: boots the practice data, routes between Home, a step and its done moment, and draws the doors, the left list and the right sheet.
import { S, DB, DEMO, hooks, savePractice, myIssueIds, seedPublicV7 } from '../staff6/data.js';
import { stepsFor, BUILT, hearingLine, left, memoKey, billNo } from './steps.js';
import { withMe, homeModel, listsHTML, overviewParts, hearingSheet, waitingSheet, suggestedSheet, bindHome, bindWaiting } from './home.js';
import { stepRow, dueStrip, band, plainBand, btn, esc, toast, clearToast, wireToast, toastHTML } from './parts.js';
import { writeSheet, bindWrite, sendStep, undoSend } from './do_write.js';
import { approveSheet, bindApprove, approveStep, undoApprove, sendBackNow } from './do_approve.js';
import { fileSheet, bindFile, fileStep, undoFile } from './do_file.js';
import { checkSheet, bindCheck, warmPosLog } from './do_check.js';   // R-398 piece 9 gap B: Check your testimony
import { askSheet, bindAsk, askStep, undoAsk } from './do_ask.js';
import { replySheet, bindReply, giveSheet, bindGive, undoRecord } from './do_reply.js';   // R-398 piece 5: the chair's reply, and giving an ask to someone
import { seedAsks } from './ask_data.js';
import { followSheet, bindFollow, decideSheet, bindDecide, viceSheet, bindVice } from './do_followup.js';   // R-398 piece 5 part 2: Follow up with the chair, Decide what next, Ask the vice chair
import { missedSheet, bindMissed, notFiledStep } from './do_missed.js';
import { doneSheet, bindDone, stopDone, UNDO_MS } from './done.js';
import { ic } from './icons7.js';
import { issuesModel, ui as issuesUi, eCig } from './issues.js';
import { issuePage } from './issue.js';
import { billParent } from './bill.js';
import { calendarModel } from './calendar.js';
import { searchModel, noteOpened, bindFind, boxHTML, findOpen } from './find.js';
import { initWidth, handleHTML, syncHandle, dragging } from './width.js';
import { hooks7 } from './sort_data.js';
import { publicBillPage } from './public.js';   // R-398 part 1b: one bill's public words (public mode)
import { publicChangePage } from './public_change.js';   // R-398 part 2: one waiting change for an admin (public mode)
import { publicListPage } from './public_list.js';   // R-398 part 2: Public words, the list (public mode)
import { teamModel } from './team.js';
import { placePage } from './do_place.js';   // R-398 piece 9 gap E: Set position and issue
import { billIssuesPage } from './bill_issues.js';   // R-398 piece 9 gap C: Issues for <bill>
import { leadsPage } from './do_leads.js';   // R-398 piece 6: the admin's lead changes   // R-398 piece 6: the Team page

const $ = id => document.getElementById(id);
const PHONE = matchMedia('(max-width: 899px)');
const DOORS = [['home', 'Home', 'house', '#/'], ['issues', 'Issues', 'layers', '#/issues'], ['calendar', 'Calendar', 'calendar', '#/calendar'], ['search', 'Search', 'search', '#/search'], ['explore', 'Explore', 'layout-grid', '#/explore']];
const WILL = { calendar: 'The week’s hearings and deadlines, in one place.', explore: 'Every other place in the app, with one line on what each is for.' };

// Session memory: the typed send-back note, what is finished and what is in flight live here and nowhere else. The data layer also keeps
// the practice copy's writes in sessionStorage (hiphi5_practice, shared with the current app's practice copy in this tab): staff7 does not fight it.
const mk = () => Object.create(null);   // keyed by step id: a name like __proto__ or toString must be an ordinary key
const SK = 'hiphi7_pages';
const saved = (() => { try { return JSON.parse(sessionStorage.getItem(SK)) || {}; } catch { return {}; } })();
const keep = () => { try { sessionStorage.setItem(SK, JSON.stringify({ stage: ctx.stage, mail: ctx.mail })); } catch { /* the page still works without it */ } };
const ctx = { me: null, notes: mk(), stage: Object.assign(mk(), saved.stage), mail: Object.assign(mk(), saved.mail), finished: mk(),
  setStage(id, n) { ctx.stage[id] = n; keep(); },
  setMail(id, m) { ctx.mail[id] = m; keep(); }, busy: new Set(), asked: new Set(), pollT: 0,   // stage: which footer a file or ask step is on (1 or 2); mail: the email as the person has changed it
  rerender: focus => render({ focus }),
  poll(fn) { clearInterval(ctx.pollT); ctx.pollT = setInterval(() => fn().catch(() => {}), 30000); },
  open() { return stepsFor(ctx.me).filter(s => !hides(ctx.finished[s.id], s)); },
  // a mark that no longer hides its step is stale: it goes, and the step can be done again
  async guard(s, fn) { const m = ctx.finished[s.id]; if (hides(m, s) || ctx.busy.has(s.id)) return; if (m) delete ctx.finished[s.id]; ctx.busy.add(s.id); try { await fn(); } finally { ctx.busy.delete(s.id); } },
  finish(s, kind, extra) {
    delete ctx.notes[s.id];
    const d = freshDraft({ billId: s.bill.id, draftId: extra.undo?.draftId || s.draft?.id });
    ctx.finished[s.id] = { step: s, at: Date.now(), kind, billId: s.bill.id, draftId: d?.id, status: d?.status, ...extra }; location.hash = '#/done/' + encodeURIComponent(s.id);
  },
  send: s => ctx.guard(s, async () => { ctx.finish(s, 'sent', { undo: await sendStep(s) }); }),
  approve: s => ctx.guard(s, async () => { ctx.finish(s, 'approved', { undo: await approveStep(s) }); }),
  // Filing, asking and the missed answers have no timed Undo; their done page keeps a text link that puts the step back (undo below)
  fileIt: s => ctx.guard(s, async () => { ctx.finish(s, 'filed', { undo: await fileStep(s) }); }),
  // "Yes, sent" reads the step again at the click: if the bills in it are not the bills the email names, nothing is recorded
  askIt: s => ctx.guard(s, async () => {
    const now = ctx.open().find(x => x.id === s.id);
    if (!now) throw new Error('This ask is no longer open, so nothing was saved. Go back to Home.');
    if (memoKey(now) !== memoKey(s)) throw new Error('The bills in this ask changed while you were writing, so nothing was saved. Open the step again to see the new email.');
    ctx.finish(s, 'asked', { undo: await askStep(now) }); }),
  lateFiled: s => ctx.guard(s, async () => { ctx.finish(s, 'recorded', { answer: 'yes', undo: await fileStep(s) }); }),
  notFiledIt: s => ctx.guard(s, async () => { ctx.finish(s, 'recorded', { answer: 'no', undo: await notFiledStep(s) }); }),
  // a send back waits out the 10 seconds (as Staff v6 does), so Undo cancels it before anything is sent; a hidden tab or a closing page sends it at once
  sendBack(s, text) {
    const m = ctx.finished[s.id]; if (hides(m, s) || ctx.busy.has(s.id)) return; if (m) delete ctx.finished[s.id];
    const id = s.id; ctx.finish(s, 'back', { note: text, status: s.draft?.status, timer: 0 });
    const f = ctx.finished[id]; f.status = s.draft?.status; f.timer = setTimeout(() => sendHeld(id), UNDO_MS + 300);
  },
  async undo(id) {
    const f = ctx.finished[id]; if (!f) return;
    try {
      if (f.kind === 'back') { if (f.sent || f.sending) throw new Error('It was already sent back.'); clearTimeout(f.timer); f.timer = 0; ctx.notes[id] = f.note; }   // sending counts as sent
      else if (f.kind === 'sent') await undoSend(f.undo);
      else if (f.kind === 'filed' || f.kind === 'recorded') await undoFile(f.undo);   // a No is never undone: done.js offers no link for it
      else if (f.kind === 'asked') await undoAsk(f.undo);
      else if (f.kind === 'replied' || f.kind === 'gave' || f.kind === 'followed') await undoRecord(f.undo);
      else await undoApprove(f.undo);
    } catch (e) { f.noUndo = true; toast((e && e.message) || 'It could not be undone.'); render({ focus: 'main h1' }); return; }
    delete ctx.finished[id]; ctx.setStage(memoKey(f.step), 1); location.hash = f.back || '#/do/' + encodeURIComponent(id);
    const words = f.kind === 'filed' || f.kind === 'recorded' ? 'Put back. The timeline still shows it was marked filed.' : f.kind === 'asked' ? 'Put back. The ask is not recorded.' : 'Undone. Nothing was sent.';
    addEventListener('hashchange', () => toast(words, { ms: 5000 }), { once: true }); } };   // after the page is drawn, which clears the old toast
// S-11: the words being written for a step are kept through Back, Close and a reload; a finished send clears them when its done page is left (Undo, from the done page, keeps them)
const clearMail = s => { let n = 0; for (const k of Object.keys(ctx.mail)) if (k === s.id || k.startsWith(s.id + '@') || k === memoKey(s) || (s.askKey && k === 'vice:' + s.askKey)) { delete ctx.mail[k]; n++; } if (n) keep(); };
const freshDraft = f => (S.drafts[f.billId] || []).find(d => d.id === f.draftId);
const hides = (f, s) => !!f && f.step.kind === s.kind && (f.status == null || freshDraft(f)?.status === f.status);   // a finished step stays hidden only while its draft is in the state that finished it
const held = () => Object.values(ctx.finished).some(f => f.kind === 'back' && f.timer);

// A held send back is sent now; if it fails, the finished mark goes, the note comes back and the step is drawn again with the reason.
async function sendHeld(id) {
  const f = ctx.finished[id]; if (!f || f.kind !== 'back' || f.sent) return;
  clearTimeout(f.timer); f.timer = 0; f.sending = true;   // from here Undo can no longer cancel it
  try { await sendBackNow(f.step, f.note); f.sent = true; }
  catch (e) { delete ctx.finished[id]; ctx.notes[id] = f.note; toast((e && e.message) || 'The send back did not go. Your note is kept.');
    if (location.hash.startsWith('#/done/')) location.hash = '#/do/' + encodeURIComponent(id); else render({}); }
}
const flushHeld = () => Object.keys(ctx.finished).forEach(id => { if (ctx.finished[id].kind === 'back' && ctx.finished[id].timer) sendHeld(id); });   // as staff6/review.js:275
// the data layer saves the practice copy on pagehide too; flushing first and saving after means a reload inside the 10 seconds keeps the send back
addEventListener('pagehide', () => { flushHeld(); savePractice(); }, true);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushHeld(); else tick(); });

let people = [];
function boot() {
  people = S.advocates.filter(a => a.is_active !== false);
  const as = new URLSearchParams(location.search).get('as');
  if (as) {
    const a = S.advocates.find(x => (x.initials || '').toUpperCase() === as.toUpperCase());
    if (!a) { ctx.unknown = as; return; }
    S.me = a; S.follows = new Set(Object.entries(S.followersBy || {}).filter(([, ids]) => ids.includes(a.id)).map(([id]) => id));
  }
  ctx.me = S.me;
}

// ---- routing ----
function parse() {
  const [path, ...qr] = location.hash.replace(/^#\/?/, '').split('?'), q = new URLSearchParams(qr.join('?'));   // an address's own "?" starts its options; a "?" in an id is %3F
  const [a, ...r] = path.split('/');
  let id = ''; try { id = decodeURIComponent(r.join('/')); } catch { if (a === 'issues' || a === 'issue' || a === 'bill' || a === 'search') return { r: a, id: '\ufffd', q }; return { r: 'missing' }; }   // an address that cannot be read is an issue or a bill that is not found, said calmly
  if (a === 'issues' || a === 'issue' || a === 'bill') return { r: a, id, q };
  if (a === 'bill-issues') return id ? { r: 'billissues', id, q } : { r: 'missing' };   // gap C: #/bill-issues/<bill>, the Issues for a bill page   // an empty or odd id is the Issues "not found" sheet, never "That step is done"

  if (a === 'search') return { r: 'search', id, q };   // the Search door: #/search, #/search/committee/<code>, #/search/person/<id>, #/search/other/<bill number>; ?q= holds the words
  if (a === 'team') return { r: 'team', id, q };   // R-398 piece 6: #/team, #/team/step/<id>, #/team/bill/<id>, #/team/give/<id>, #/team/done/<id>, #/team/many
  if (a === 'calendar') return { r: 'calendar', id, q };   // Calendar: the week, a sitting (calendar/sitting/<key>) or a deadline (calendar/deadline/<key>)
  // R-398: #/public is Public words (part 2); #/public/change/<id> is one waiting change (part 2); #/public/<bill number> is one bill's public words (part 1b)
  if (a === 'public') {
    const rest = r.filter(x => x !== '');
    if (!rest.length) return { r: 'publiclist', q };
    if (rest[0] === 'change') { let cid = ''; try { cid = decodeURIComponent(rest.slice(1).join('/')); } catch { cid = '�'; } return cid ? { r: 'publicchange', id: cid, q } : { r: 'missing' }; }
    return id ? { r: 'publicbill', id, q } : { r: 'missing' };
  }
  if (a === 'do' || a === 'done' || a === 'hearing' || a === 'waiting' || a === 'suggested' || a === 'ask' || a === 'give') return id ? { r: a, id } : { r: 'missing' };
  if (a === 'vice') return id ? { r: 'vice', id, q } : { r: 'missing' };   // Ask the vice chair (do_followup.js): #/vice/<ask key>?to=<legislator id>
  if (a && Object.hasOwn(WILL, a)) return { r: 'door', door: a };
  return a ? { r: 'missing' } : { r: 'home' };
}

// ---- the frame ----
const bar = cur => `<nav class="bar" aria-label="Main"><a class="brand" href="#/" aria-label="HIPHI Tracker, Home">H</a><ul>${DOORS.map(([k, n, i, h]) =>
  `<li><a class="bi"${k === cur ? ' aria-current="page"' : ''} href="${h}"><span class="rpill">${ic(i)}</span><span>${n}</span></a></li>`).join('')}</ul>`
  + `<span class="who"><span class="person" title="${esc(ctx.me?.full_name)}" role="img" aria-label="Signed in as ${esc(ctx.me?.full_name)}">${esc(ctx.me?.initials)}</span><span class="prac">Practice</span></span></nav>`;

// ---- the sheets ----
function doorSheet(k) {
  const name = DOORS.find(d => d[0] === k)[1];
  return `<div class="pn">${plainBand(name, WILL[k])}<div class="pbody"><p class="lead"><span class="stmark">${ic('clock')}<span>Not built yet</span></span></p><p class="lead">This place is coming. Your steps are on Home.</p><div class="sfoot plain">${btn('Back to Home', { kind: 'filled', href: '#/' })}</div></div></div>`;
}
const unbuiltSheet = s => `<div class="pn">${band(s.issue, s.verb, s.name, s.no)}<div class="pbody">${dueStrip(s, { hearing: hearingLine(s.hearing) })}<p class="lead">This step’s page is being built.</p></div></div>`;
const missingSheet = () => `<div class="pn">${plainBand('That step is done or no longer yours.', '')}<div class="pbody"></div></div>`;
const peopleSheet = () => `<div class="pn">${plainBand(`No practice person ${ctx.unknown}.`, 'Pick one of these.')}<div class="pbody"><ul class="people">${people.map(a => `<li><a class="btn quiet" href="?demo=1&as=${encodeURIComponent(a.initials)}">${esc(a.full_name)} · ${esc(a.initials)}</a></li>`).join('')}</ul></div></div>`;
const sheetFor = s => s.kind === 'write' || s.kind === 'resubmit' ? [writeSheet(s, ctx), () => bindWrite(s, ctx)]
  : s.kind === 'approve' || s.kind === 'second' ? [approveSheet(s, ctx), () => bindApprove(s, ctx)]
  : s.kind === 'file' ? [fileSheet(s, ctx), () => bindFile(s, ctx)] : s.kind === 'check' ? [checkSheet(s, ctx), () => bindCheck(s, ctx)] : s.kind === 'ask' ? [askSheet(s, ctx), () => bindAsk(s, ctx)] : s.kind === 'chairfu' ? [followSheet(s, ctx), () => bindFollow(s, ctx)] : s.kind === 'decide' ? [decideSheet(s), () => bindDecide(s, ctx)] : s.kind === 'missed' ? [missedSheet(s, ctx), () => bindMissed(s, ctx)] : [unbuiltSheet(s), null];

// ---- the trail (R-398, Nate 20 Nov): where the person has been this session, so Back and Close go to the screen they came from ----
// Each page the person opens is one entry; its place in the browser's own history is written to history.state (t7), so Back (the link, the X, Escape)
// is history.go(-n) when the screen before is a real entry, and the browser's Back button, Forward and a reload all agree with it. A page opened
// straight from a link has nothing before it: Back and Close then go to its natural parent and replace it, so nothing loops.
const TK = 'hiphi7_trail', CAP = 60;
const trail = (() => {
  try { const t = JSON.parse(sessionStorage.getItem(TK)), nav = performance.getEntriesByType?.('navigation')[0];
    if (t && Array.isArray(t.s) && Number.isInteger(t.i) && Number.isInteger(t.o) && nav && nav.type !== 'navigate') return t; } catch { /* a fresh trail */ }   // a page opened by address starts a new trail; a reload keeps it
  return { s: [], i: -1, o: 0 };   // s: [{ h, name, fam }]; i: the entry shown; o: how many oldest entries were dropped (history.state counts from the first ever)
})();
const saveTrail = () => { try { sessionStorage.setItem(TK, JSON.stringify(trail)); } catch { /* the trail still works in memory */ } };
let replacing = false, leftFrom = '', here = { tgt: null, opened: false };
function track(h, name, fam) {
  const st = history.state, k = st && Number.isInteger(st.t7) ? st.t7 - trail.o : -1;
  if (k >= 0 && k < trail.s.length) { trail.i = k; trail.s[k] = { h, name, fam }; }   // an entry we know: Back, Forward or a reload
  else if (replacing && trail.i >= 0) { trail.s[trail.i] = { h, name, fam }; trail.s.length = trail.i + 1; }   // Close on a page with nothing before it: the parent takes its place
  else if (trail.i >= 0 && trail.s[trail.i].h === h) trail.s[trail.i] = { h, name, fam };   // drawn again, same page
  else { trail.s.length = trail.i + 1; trail.s.push({ h, name, fam }); trail.i = trail.s.length - 1; if (trail.s.length > CAP) { trail.s.shift(); trail.o++; trail.i--; } }
  replacing = false; saveTrail();
}
// the entry's place is written to the browser's history state at the END of a draw, after find.js has written its own state
const stamp = () => { if (trail.i < 0) return; try { history.replaceState({ ...(history.state || {}), t7: trail.o + trail.i }, ''); } catch { /* the address stays as it is */ } };
// the path of a flow that ends in a "done" page: Back from the done page skips the steps that made it (the step is finished and gone)
const FLOW = /^#\/(do|done|give|vice)\/|^#\/team\/(step|give|done)\/|^#\/team\/many\/(give|done)/;
const isDoneLike = h => /^#\/done\/|^#\/team\/done\/|^#\/team\/many\/done/.test(h);
// where Back and Close go: the screen before in the trail (skipping this page's own family or flow), else the page's natural parent
function targetOf(h, fam, nat) {
  let j = trail.i - 1;
  while (j >= 0 && ((fam && trail.s[j].fam === fam) || (isDoneLike(h) && FLOW.test(trail.s[j].h)))) j--;
  return j >= 0 ? { h: trail.s[j].h, name: trail.s[j].name, steps: trail.i - j } : { h: nat.h, name: nat.name, steps: 0 };
}
function leave() {
  const t = here.tgt; if (!t) return;
  leftFrom = location.hash;
  if (t.steps > 0) history.go(-t.steps); else { replacing = true; location.replace(t.h); }
}
const topRow = t => `<div class="toprow"><a class="back" id="tbBack" href="${esc(t.h)}">${ic('chevron-left')}Back to ${esc(t.name)}</a><button class="xbtn" id="tbClose" type="button" aria-label="Close">${ic('x')}</button></div>`;
// the name an entry is called when a later page says "Back to ..."
function nameOf(rt, im, label) {
  const id = String(rt.id || '');
  switch (rt.r) {
    case 'home': return 'Home';
    case 'do': return id === 'leads' ? 'Lead changes' : 'the step';
    case 'hearing': return 'the hearing';
    case 'waiting': return 'Waiting on others';
    case 'suggested': return 'the suggestion';
    case 'done': return 'the finished step';
    case 'ask': return 'the reply';
    case 'give': return 'Give this ask';
    case 'vice': return 'the ask';
    case 'issues': return !id ? 'Issues' : id === 'session' ? 'the session' : id === 'bills' ? 'All bills' : /^new(\/|$)/.test(id) ? 'New bills' : /^topic\//.test(id) ? 'the topic' : 'Issues';
    case 'issue': return (im?.pageIssue && eCig(im.pageIssue.name)) || 'the issue';
    case 'bill': return 'the bill';
    case 'billissues': return 'the issues';
    case 'calendar': return 'Calendar';
    case 'search': return !id ? 'Search' : 'the search result';
    case 'team': return !id ? 'Team' : id === 'many' ? 'the list' : id.startsWith('step/') ? 'the step' : id.startsWith('bill/') ? 'the bill' : 'Team';
    case 'publicbill': return 'the public words';
    case 'publiclist': return 'Public words';
    case 'publicchange': return 'the change';
    case 'door': return label;
    default: return 'the page';
  }
}
function naturalOf(rt, im) {
  const id = String(rt.id || '');
  if (rt.r === 'give') return { h: '#/ask/' + encodeURIComponent(id), name: 'the reply' };
  if (rt.r === 'publicbill') return { h: '#/bill/' + encodeURIComponent(id), name: 'the bill' };
  if (rt.r === 'billissues') return { h: '#/bill/' + encodeURIComponent(id), name: 'the bill' };
  if (rt.r === 'publicchange') return { h: '#/public', name: 'Public words' };
  if (im?.back) return { h: im.back, name: im.backLabel || 'Issues' };
  return { h: '#/', name: 'Home' };
}
// Escape: a panel that is open closes first (its button gets the focus back), else an opened page closes. A text field keeps its own Escape.
const PANELS = '#whoMate, #abFilt, #tpBtn, #seeMail';
addEventListener('keydown', e => {
  if (e.key !== 'Escape' || e.defaultPrevented || e.isComposing) return;
  const a = document.activeElement;
  if (a && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable)) return;
  const p = [...document.querySelectorAll(PANELS)].find(b => b.getAttribute('aria-expanded') === 'true' && b.getBoundingClientRect().width > 0 && (() => { const c = document.getElementById(b.getAttribute('aria-controls')); return !c || (!c.hidden && c.getClientRects().length > 0); })());
  if (p) { e.preventDefault(); p.click(); p.focus({ preventScroll: true }); return; }
  if (here.opened) { e.preventDefault(); leave(); }
});
addEventListener('click', e => {
  const x = e.target.closest?.('[data-closes]');   // a panel's own X: closes it and gives the focus back to the button that opened it
  if (x) { const b = document.getElementById(x.dataset.closes); if (b && b.getAttribute('aria-expanded') === 'true') { e.preventDefault(); b.click(); b.focus({ preventScroll: true }); } return; }
  const el = e.target.closest?.('#tbBack, #tbClose'); if (!el || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault(); leave();
});

// ---- draw ----
let lastRoute = '', lastFam = '', first = true;
// Public mode: the bill's public words with no app bar and no left column, the window plum (tokens.css). Only this route is drawn so.
// It has the same top row as every opened page (Back to where the person came from, and Close), drawn into the plum band in place of "Leave public mode".
function drawPublic(rt, opts = {}) {
  document.documentElement.dataset.mode = 'public';
  document.body.classList.remove('isws', 'hasbar', 'nobar');
  $('bar-slot').innerHTML = '';
  if (!opts.tick) track(location.hash, nameOf(rt, null, ''), '');
  const tgt = targetOf(location.hash, '', naturalOf(rt, null)); here = { tgt, opened: true };
  const pg = rt.r === 'publiclist' ? publicListPage({ q: rt.q, back: tgt.h })
    : rt.r === 'publicchange' ? publicChangePage({ id: rt.id, q: rt.q, back: tgt.h })
    : publicBillPage({ id: rt.id, q: rt.q, back: tgt.h });
  $('app').innerHTML = pg.html;
  const w = document.querySelector('#app .pub-band .pub-wrap');
  if (w) {
    w.querySelector(':scope > a.btn')?.remove();
    w.insertAdjacentHTML('afterbegin', `<a class="btn quiet pub-back" id="tbBack" href="${esc(tgt.h)}">${ic('chevron-left')}<span class="pub-long">Back to ${esc(tgt.name)}</span><span class="pub-short">Back</span></a>`);
    w.insertAdjacentHTML('beforeend', `<button class="btn quiet pub-x" id="tbClose" type="button" aria-label="Close">${ic('x')}</button>`);
  }
  pg.bind();
  if (location.hash !== lastRoute) clearToast();   // a toast belongs to the page it was said on
  if (leftFrom && !opts.tick) { const o = [...document.querySelectorAll('#app a[href]')].find(a => a.getAttribute('href') === leftFrom && a.getBoundingClientRect().width > 0); if (o) o.focus({ preventScroll: true }); }
  leftFrom = ''; stamp(); lastRoute = location.hash; first = false; document.documentElement.dataset.ready = '1';
}
function render(opts = {}) {
  stopDone(); clearInterval(ctx.pollT);
  if (!opts.tick && lastRoute.startsWith('#/done/') && location.hash !== lastRoute) { let id = ''; try { id = decodeURIComponent(lastRoute.slice(7)); } catch { /* none */ } const f = ctx.finished[id]; if (f && f.step) clearMail(f.step); }
  const keepScroll = opts.tick ? [...document.querySelectorAll('.wl, .paper')].map(e => [e, e.scrollTop]) : [], tpOpen = opts.tick && !!document.getElementById('tpList') && !document.getElementById('tpList').hidden;
  const wasOpen = findOpen(), ae = document.activeElement, had = ae && ae.id, hadHref = ae && ae.tagName === 'A' && ae.closest('#app') ? ae.getAttribute('href') : '';   // a row link has no id: it is found again by its address
  if (ctx.unknown) { $('bar-slot').innerHTML = ''; $('app').innerHTML = `<div class="ws one"><div class="wp"><div class="paper">${peopleSheet()}</div></div></div>`; document.documentElement.dataset.ready = '1'; return; }
  // R-398 part 1b: public mode is drawn by drawPublic (no bar, no list, plum); any other address leaves it
  const rt0 = parse();
  if (rt0.r === 'publicbill' || rt0.r === 'publicchange' || rt0.r === 'publiclist') { drawPublic(rt0, opts); return; }
  delete document.documentElement.dataset.mode;
  const rt = parse(), open = ctx.open(), m = homeModel(ctx.me, open), phone = PHONE.matches;
  let sheet = '', bindFn = null, cur = 'home', one = false, label = 'Step', ov = null, im = null, bIss = null;
  { const fam = rt.r === 'calendar' ? 'c' : /^(issues|issue|bill)$/.test(rt.r) ? 'i' : ''; if (!fam || fam !== lastFam) issuesUi.pick = false; lastFam = fam; }   // the teammate picker is open only within one tab's routes   // the teammate picker is open only within the Issues routes
  if (rt.r === 'home') {
    ov = overviewParts(m); sheet = `<div class="pn"><div class="ov">${ov.top}${ov.rest}</div></div>`; label = 'Overview';
  } else if (rt.r === 'do' && rt.id === 'leads') {
    const pg = leadsPage(ctx.me); sheet = pg.html; bindFn = pg.bind; label = 'Lead changes';   // #/do/leads (an admin's step; do_leads.js)
  } else if (rt.r === 'do' && /^pl-/.test(rt.id)) {
    const pg = placePage(rt.id); if (pg) { sheet = pg.html; bindFn = pg.bind; label = 'Position and issue'; } else sheet = missingSheet();   // gap E: still drawn once both are set, so the page never turns into "done" under the person's hands
  } else if (rt.r === 'do') {
    const s = open.find(x => x.id === rt.id);
    if (!s) sheet = missingSheet(); else [sheet, bindFn] = sheetFor(s);
  } else if (rt.r === 'hearing') { sheet = hearingSheet(m, rt.id) || missingSheet(); label = 'Hearing today'; }
  else if (rt.r === 'waiting') { sheet = waitingSheet(m, rt.id) || missingSheet(); bindFn = bindWaiting; label = 'Waiting on others'; }
  else if (rt.r === 'ask') { sheet = replySheet(rt.id) || missingSheet(); bindFn = () => bindReply(rt.id, ctx); label = 'Did the chair reply?'; }
  else if (rt.r === 'vice') { sheet = viceSheet(rt.id, ctx, rt.q) || missingSheet(); bindFn = () => bindVice(rt.id, ctx, rt.q); label = 'Ask the vice chair'; }
  else if (rt.r === 'give') { sheet = giveSheet(rt.id) || missingSheet(); bindFn = () => bindGive(rt.id, ctx); label = 'Give this ask'; }
  else if (rt.r === 'suggested') { sheet = suggestedSheet(m, rt.id, new URLSearchParams(location.search).get('as')) || missingSheet(); label = 'Suggested step'; }
  else if (rt.r === 'done') {
    sheet = doneSheet(ctx, rt.id, freshDraft) || missingSheet(); bindFn = () => bindDone(ctx, rt.id);
  } else if (rt.r === 'issues' || rt.r === 'issue' || rt.r === 'bill') {
    cur = 'issues'; im = issuesModel({ me: ctx.me, open, rt, people }); sheet = im.sheet; label = im.label; bindFn = im.bind;
    // an issue's own page is issue.js (the list on the left and the not-found sheet are still issues.js's)
    if (im.pageIssue && !im.notFound) {
      const issue = im.pageIssue, mine = new Set(withMe(ctx.me, () => [...myIssueIds()]).map(String));
      if (issue) { const pg = issuePage({ issue, me: ctx.me, open, who: im.who, row: im.ses ? (im.ses.next?.row || null) : undefined, own: mine.has(String(issue.id)), back: im.back, backLabel: im.backLabel }), b0 = im.bind; sheet = pg.html; bindFn = () => { b0 && b0(); pg.bind(); }; }
    }
  } else if (rt.r === 'billissues') {   // gap C: the Issues list stays on the left; the page is bill_issues.js
    cur = 'issues'; im = issuesModel({ me: ctx.me, open, rt: { r: 'bill', id: rt.id, q: rt.q }, people }); const pg = billIssuesPage({ ref: rt.id }), b0 = im.bind; sheet = pg.html; label = 'Issues for the bill'; bindFn = () => { b0 && b0(); pg.bind(); }; bIss = pg.bill;
  } else if (rt.r === 'calendar') {
    cur = 'calendar'; im = calendarModel({ me: ctx.me, open, rt, people, phone }); sheet = im.sheet; label = im.label; bindFn = im.bind;
  } else if (rt.r === 'team') {
    im = teamModel({ me: ctx.me, rt, open, phone }); sheet = im.sheet; label = im.label; bindFn = im.bind;   // the Home door stays lit on Team (cur stays 'home')
  } else if (rt.r === 'search') {
    cur = 'search'; im = searchModel({ rt }); sheet = im.sheet; label = im.label; bindFn = im.bind;
  } else if (rt.r === 'door') { cur = rt.door; sheet = doorSheet(rt.door); one = true; label = DOORS.find(d => d[0] === rt.door)[1]; }
  else sheet = missingSheet();
  const onHome = rt.r === 'home', stepPage = rt.r !== 'home' && rt.r !== 'door' && !im;
  const solo = !!im?.solo;   // a page with no list beside it (All bills)
  const cls = `ws${one || solo ? ' one' : ''}${im?.wide ? ' gridws' : ''}${im?.fixedList ? ' teamws' : ''}${phone ? (onHome ? ' homeone' : im ? (im.picked || solo ? ' sheetonly isn' : im.listOnly ? ' listonly isn' : ' isn') : ' sheetonly') : ''}`;
  // R-398: the one top row. Home and the door landings (the lists) have none; every page opened from them has Back and Close.
  const fam = rt.r === 'issues' && /^new(\/|$)/.test(String(rt.id || '')) ? 'sort' : '';
  const opened = !onHome && !one && (!im || rt.r === 'bill' || rt.r === 'billissues' || (!!im.back && (im.picked || im.solo || fam === 'sort' || /^topic\//.test(String(rt.id || '')))));
  if (!opts.tick) track(location.hash, nameOf(rt, im, label), fam);
  const nat = naturalOf(rt, im && rt.r === 'bill' && !im.back ? { ...im, back: billParent.h, backLabel: billParent.name } : im);
  const tgt = opened ? targetOf(location.hash, fam, nat) : null; here = { tgt, opened };
  if (tgt && bIss && /^#\/bill\//.test(tgt.h)) tgt.name = billNo(bIss);   // gap C: "Back to HB 1005"
  const row = opened ? topRow(tgt) : '', rowInList = opened && phone && im && !im.picked && !solo && !im.listOnly;
  document.body.classList.add('isws', 'hasbar'); document.body.classList.toggle('nobar', phone && stepPage);
  $('bar-slot').innerHTML = bar(cur); $('bar-slot').firstElementChild.classList.toggle('off', phone && stepPage);
  const paper = (html, lab) => `<div class="paper enter" role="region" aria-label="${esc(lab)}">${html}</div>`;
  const lists = one || solo ? '' : `<div class="wl" id="wl">${rowInList ? row : ''}${im ? im.col : boxHTML() + listsHTML(m, location.hash)}</div>`;
  const grip = phone || one || solo || im?.wide || im?.fixedList ? '' : handleHTML();   // the width handle sits between the list and the page; not on a phone, not where there is no list beside the page, not above Calendar's Week grid
  // on a phone the greeting comes first, then the lists, then the facts and the session: the thing to do is never below a screen of overview
  $('app').innerHTML = ov && phone ? `<div class="${cls}"><div class="wp ovp1">${paper(`<div class="pn"><div class="ov">${ov.top}</div></div>`, label)}</div>${lists}<div class="wp ovp2">${paper(`<div class="pn"><div class="ov">${ov.rest}</div></div>`, 'The overview, continued')}</div></div>`
    : `<div class="${cls}">${lists}${grip}<div class="wp">${opened && !rowInList ? row : ''}${paper(sheet, label)}</div></div>`;
  if (phone) document.body.classList.remove('isws');
  if (opened) document.querySelectorAll('#app [data-notfound] .pbody p.lead > a.btn.text').forEach(a => { if (/^Back to/.test(a.textContent.trim())) { const p = a.parentElement; a.remove(); if (!p.textContent.trim()) p.remove(); } });
  bindHome(); bindFn && bindFn({ sync: () => { lastRoute = location.hash; }, tick: !!opts.tick });   // sync: a page that changes its own address (replaceState) tells the frame, so the next minute's redraw does not take it for a new page
  if (!opts.tick) noteOpened(rt);
  bindFind({ tick: !!opts.tick, hadFocus: had === 'findIn', wasOpen, sync: () => { lastRoute = location.hash; }, rerender: () => render({}), keep: () => render({ tick: true }) });
  syncHandle();   // the handle's numbers from the drawn column, and the drag's mark if one is going
  if (opts.tick) {   // a tick changes only the numbers: no entry animation, same scroll, talking points as they were
    document.querySelectorAll('#app .enter').forEach(e => e.classList.remove('enter'));
    const tl = document.getElementById('tpList'), tb = document.getElementById('tpBtn'); if (tpOpen && tl) { tl.hidden = false; tb?.setAttribute('aria-expanded', 'true'); }
    keepScroll.forEach(([e, y]) => { const n = e.classList.contains('wl') ? document.querySelector('.wl') : document.querySelector('.paper'); if (n) n.scrollTop = y; });
  }
  if (location.hash !== lastRoute) clearToast();   // a toast belongs to the page it was said on
  const key = location.hash, vis = sel => [...document.querySelectorAll(sel)].find(e => e.getBoundingClientRect().width > 0);
  const target = (opts.focus && vis(opts.focus)) || (opts.tick && had && document.getElementById(had)) || (opts.tick && hadHref && [...document.querySelectorAll('#app a[href]')].find(a => a.getAttribute('href') === hadHref && a.getBoundingClientRect().width > 0));
  const opener = !opts.tick && leftFrom && [...document.querySelectorAll('#app a[href]')].find(a => a.getAttribute('href') === leftFrom && a.getBoundingClientRect().width > 0);   // after Back or Close: the row that opened the page, if it is on the screen
  if (opener) { opener.focus({ preventScroll: true }); opener.scrollIntoView({ block: 'nearest' }); }
  else if (target) target.focus({ preventScroll: true });
  else if (!first && (key !== lastRoute || !document.activeElement || document.activeElement === document.body)) { const h1 = vis('main h1'); h1 && h1.focus({ preventScroll: true }); if (key !== lastRoute) window.scrollTo(0, 0); }
  if (!opts.tick && (!document.activeElement || document.activeElement === document.body)) { const h1 = vis('main h1'); h1 && h1.focus({ preventScroll: true }); }   // focus never drops to the page body
  if (rt.r === 'search' && !phone && !opts.tick && !im.picked) $('findIn')?.focus({ preventScroll: true });   // the Search door opens with the cursor in the box (on a phone it would raise the keyboard)
  if (!opts.tick) leftFrom = '';
  stamp();
  first = false; lastRoute = key; document.documentElement.dataset.ready = '1';
}

// The times tick: drawn again each minute and on coming back to the tab, only when nothing is being typed, held or sent.
function tick() {
  const a = document.activeElement, field = a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName), tst = document.getElementById('toast');
  const quiet = field || document.querySelector('#sbBox:not([hidden]), .errt:not([hidden])') || (tst?.classList.contains('on') && !document.getElementById('toastUndo').hidden) || dragging();
  if (document.visibilityState !== 'visible' || quiet || held() || ctx.busy.size || document.querySelector('.is-loading') || !/^(|#|#\/|#\/(do|hearing|waiting|suggested|issue|bill)\/.*|#\/team(\/.*)?|#\/(issue|bill)\/?|#\/issues(\/[^?]*)?(\?.*)?|#\/calendar(\/[^?]*)?(\?.*)?|#\/search(\/[^?]*)?(\?.*)?)$/.test(location.hash)) return;
  render({ tick: true });
}
window.__staff7Tick = tick;
window.__staff7TrailReset = () => { trail.s = []; trail.i = -1; trail.o = 0; saveTrail(); try { history.replaceState(null, ''); } catch { /* none */ } };   // the tests make the next address a page opened by address, with nothing before it
window.__staff7Render = o => render(o);   // the tests force a redraw even while a field has the focus   // the tests call the minute's redraw directly
hooks7.draw = o => render(o);   // a read that the person is waiting on (the next bills, an introducers list): drawn at once, scroll and focus kept
hooks7.render = o => o && o.tick ? tick() : render(o);   // Sort new bills: a queue that lands after the page is drawn draws it again the way the minute's tick does (never over a field being typed in)

hooks.toast = m => toast(m);
async function start() {
  if (!DEMO) throw new Error('staff7 is practice-only');   // the second lock, before anything is loaded
  await DB.init(); await DB.loadAll();
  await DB.chairAsks().catch(() => {});   // as the current app's afterLoad: a teammate's recorded ask is known (the practice copy answers with none)
  seedAsks();   // R-398 piece 5: the practice copy's chair ask (Kevin, SB 2175)
  boot(); seedPublicV7(); initWidth(ctx.me);   // R-398: public mode's practice rules and seeds, once the person is known (after as=); then the width this person left the list at, before the first draw so nothing jumps
  $('toast-slot').innerHTML = toastHTML; wireToast();
  window.addEventListener('hashchange', () => render()); PHONE.addEventListener('change', () => render());
  setInterval(tick, 60000);
  render(); warmPosLog(() => render());   // gap B: live, the position-change times of bills with approved testimony (the practice copy keeps its own)
}
start().catch(e => { console.error(e); $('app').innerHTML = '<div class="msg"><h1>We could not load the practice copy</h1><p>Reload the page to try again.</p></div>'; });
