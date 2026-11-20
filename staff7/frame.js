// Staff7's frame: boots the practice data, routes between Home, a step and its done moment, and draws the doors, the left list and the right sheet.
import { S, DB, DEMO, hooks, savePractice, myIssueIds, seedPublicV7 } from '../staff6/data.js';
import { stepsFor, BUILT, hearingLine, left, memoKey } from './steps.js';
import { withMe, homeModel, listsHTML, overviewParts, hearingSheet, waitingSheet, suggestedSheet, bindHome, bindWaiting } from './home.js';
import { stepRow, dueStrip, band, plainBand, btn, esc, toast, clearToast, wireToast, toastHTML } from './parts.js';
import { writeSheet, bindWrite, sendStep, undoSend } from './do_write.js';
import { approveSheet, bindApprove, approveStep, undoApprove, sendBackNow } from './do_approve.js';
import { fileSheet, bindFile, fileStep, undoFile } from './do_file.js';
import { askSheet, bindAsk, askStep, undoAsk } from './do_ask.js';
import { missedSheet, bindMissed, notFiledStep } from './do_missed.js';
import { doneSheet, bindDone, stopDone, UNDO_MS } from './done.js';
import { ic } from './icons7.js';
import { issuesModel, ui as issuesUi } from './issues.js';
import { issuePage } from './issue.js';
import { calendarModel } from './calendar.js';
import { searchModel, noteOpened, bindFind, boxHTML, findOpen } from './find.js';
import { initWidth, handleHTML, syncHandle, dragging } from './width.js';
import { hooks7 } from './sort_data.js';
import { publicBillPage } from './public.js';   // R-398 part 1b: one bill's public words (public mode)
import { publicChangePage } from './public_change.js';   // R-398 part 2: one waiting change for an admin (public mode)
import { publicListPage } from './public_list.js';   // R-398 part 2: Public words, the list (public mode)
import { teamModel } from './team.js';
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
      else await undoApprove(f.undo);
    } catch (e) { f.noUndo = true; toast((e && e.message) || 'It could not be undone.'); render({ focus: 'main h1' }); return; }
    delete ctx.finished[id]; ctx.setStage(memoKey(f.step), 1); location.hash = '#/do/' + encodeURIComponent(id);
    const words = f.kind === 'filed' || f.kind === 'recorded' ? 'Put back. The timeline still shows it was marked filed.' : f.kind === 'asked' ? 'Put back. The ask is not recorded.' : 'Undone. Nothing was sent.';
    addEventListener('hashchange', () => toast(words, { ms: 5000 }), { once: true }); } };   // after the page is drawn, which clears the old toast
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
  if (a === 'issues' || a === 'issue' || a === 'bill') return { r: a, id, q };   // an empty or odd id is the Issues "not found" sheet, never "That step is done"

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
  if (a === 'do' || a === 'done' || a === 'hearing' || a === 'waiting' || a === 'suggested') return id ? { r: a, id } : { r: 'missing' };
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
const missingSheet = () => `<div class="pn">${plainBand('That step is done or no longer yours.', '')}<div class="pbody"><p class="lead"><a class="btn text" href="#/">Back to Home</a></p></div></div>`;
const peopleSheet = () => `<div class="pn">${plainBand(`No practice person ${ctx.unknown}.`, 'Pick one of these.')}<div class="pbody"><ul class="people">${people.map(a => `<li><a class="btn quiet" href="?demo=1&as=${encodeURIComponent(a.initials)}">${esc(a.full_name)} · ${esc(a.initials)}</a></li>`).join('')}</ul></div></div>`;
const sheetFor = s => s.kind === 'write' || s.kind === 'resubmit' ? [writeSheet(s, ctx), () => bindWrite(s, ctx)]
  : s.kind === 'approve' || s.kind === 'second' ? [approveSheet(s, ctx), () => bindApprove(s, ctx)]
  : s.kind === 'file' ? [fileSheet(s, ctx), () => bindFile(s, ctx)] : s.kind === 'ask' ? [askSheet(s, ctx), () => bindAsk(s, ctx)] : s.kind === 'missed' ? [missedSheet(s, ctx), () => bindMissed(s, ctx)] : [unbuiltSheet(s), null];

// ---- draw ----
let lastRoute = '', lastFam = '', first = true;
// R-398 part 1b: the address the person was on before public mode; "Leave public mode" goes back to it (a bill's page when they came straight in)
let lastPlain = '';
// Public mode: the bill's public words with no app bar and no left column, the window plum (tokens.css). Only this route is drawn so.
function drawPublic(rt) {
  document.documentElement.dataset.mode = 'public';
  document.body.classList.remove('isws', 'hasbar', 'nobar');
  $('bar-slot').innerHTML = '';
  const pg = rt.r === 'publiclist' ? publicListPage({ q: rt.q, back: lastPlain })
    : rt.r === 'publicchange' ? publicChangePage({ id: rt.id, q: rt.q, back: lastPlain })
    : publicBillPage({ id: rt.id, q: rt.q, back: lastPlain });
  $('app').innerHTML = pg.html; pg.bind();
  if (location.hash !== lastRoute) clearToast();   // a toast belongs to the page it was said on
  lastRoute = location.hash; first = false; document.documentElement.dataset.ready = '1';
}
function render(opts = {}) {
  stopDone(); clearInterval(ctx.pollT);
  const keepScroll = opts.tick ? [...document.querySelectorAll('.wl, .paper')].map(e => [e, e.scrollTop]) : [], tpOpen = opts.tick && !!document.getElementById('tpList') && !document.getElementById('tpList').hidden;
  const wasOpen = findOpen(), ae = document.activeElement, had = ae && ae.id, hadHref = ae && ae.tagName === 'A' && ae.closest('#app') ? ae.getAttribute('href') : '';   // a row link has no id: it is found again by its address
  if (ctx.unknown) { $('bar-slot').innerHTML = ''; $('app').innerHTML = `<div class="ws one"><div class="wp"><div class="paper">${peopleSheet()}</div></div></div>`; document.documentElement.dataset.ready = '1'; return; }
  // R-398 part 1b: public mode is drawn by drawPublic (no bar, no list, plum); any other address leaves it
  const rt0 = parse();
  if (rt0.r === 'publicbill' || rt0.r === 'publicchange' || rt0.r === 'publiclist') { drawPublic(rt0); return; }
  delete document.documentElement.dataset.mode;
  lastPlain = location.hash;
  const rt = parse(), open = ctx.open(), m = homeModel(ctx.me, open), phone = PHONE.matches;
  let sheet = '', bindFn = null, cur = 'home', one = false, label = 'Step', ov = null, im = null;
  { const fam = rt.r === 'calendar' ? 'c' : /^(issues|issue|bill)$/.test(rt.r) ? 'i' : ''; if (!fam || fam !== lastFam) issuesUi.pick = false; lastFam = fam; }   // the teammate picker is open only within one tab's routes   // the teammate picker is open only within the Issues routes
  if (rt.r === 'home') {
    ov = overviewParts(m); sheet = `<div class="pn"><div class="ov">${ov.top}${ov.rest}</div></div>`; label = 'Overview';
  } else if (rt.r === 'do' && rt.id === 'leads') {
    const pg = leadsPage(ctx.me); sheet = pg.html; bindFn = pg.bind; label = 'Lead changes';   // #/do/leads (an admin's step; do_leads.js)
  } else if (rt.r === 'do') {
    const s = open.find(x => x.id === rt.id);
    if (!s) sheet = missingSheet(); else [sheet, bindFn] = sheetFor(s);
  } else if (rt.r === 'hearing') { sheet = hearingSheet(m, rt.id) || missingSheet(); label = 'Hearing today'; }
  else if (rt.r === 'waiting') { sheet = waitingSheet(m, rt.id) || missingSheet(); bindFn = bindWaiting; label = 'Waiting on others'; }
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
  const back = im ? (im.picked && im.back ? `<a class="back backhome" href="${esc(im.back)}">${ic('chevron-left')}Back to ${im.backLabel || 'Issues'}</a>` : '') : onHome || one ? '' : `<a class="back backhome" href="#/">${ic('chevron-left')}${['do', 'done', 'hearing', 'waiting', 'suggested'].includes(rt.r) ? 'Back to overview' : 'Back to Home'}</a>`;
  document.body.classList.add('isws', 'hasbar'); document.body.classList.toggle('nobar', phone && stepPage);
  $('bar-slot').innerHTML = bar(cur); $('bar-slot').firstElementChild.classList.toggle('off', phone && stepPage);
  const paper = (html, lab) => `<div class="paper enter" role="region" aria-label="${esc(lab)}">${html}</div>`;
  const lists = one || solo ? '' : `<div class="wl" id="wl">${im ? im.col : boxHTML() + listsHTML(m, location.hash)}</div>`;
  const grip = phone || one || solo || im?.wide || im?.fixedList ? '' : handleHTML();   // the width handle sits between the list and the page; not on a phone, not where there is no list beside the page, not above Calendar's Week grid
  // on a phone the greeting comes first, then the lists, then the facts and the session: the thing to do is never below a screen of overview
  $('app').innerHTML = ov && phone ? `<div class="${cls}"><div class="wp ovp1">${paper(`<div class="pn"><div class="ov">${ov.top}</div></div>`, label)}</div>${lists}<div class="wp ovp2">${paper(`<div class="pn"><div class="ov">${ov.rest}</div></div>`, 'The overview, continued')}</div></div>`
    : `<div class="${cls}">${lists}${grip}<div class="wp">${back}${paper(sheet, label)}</div></div>`;
  if (phone) document.body.classList.remove('isws');
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
  if (target) target.focus({ preventScroll: true });
  else if (!first && (key !== lastRoute || !document.activeElement || document.activeElement === document.body)) { const h1 = vis('main h1'); h1 && h1.focus({ preventScroll: true }); if (key !== lastRoute) window.scrollTo(0, 0); }
  if (!opts.tick && (!document.activeElement || document.activeElement === document.body)) { const h1 = vis('main h1'); h1 && h1.focus({ preventScroll: true }); }   // focus never drops to the page body
  if (rt.r === 'search' && !phone && !opts.tick && !im.picked) $('findIn')?.focus({ preventScroll: true });   // the Search door opens with the cursor in the box (on a phone it would raise the keyboard)
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
window.__staff7Render = o => render(o);   // the tests force a redraw even while a field has the focus   // the tests call the minute's redraw directly
hooks7.draw = o => render(o);   // a read that the person is waiting on (the next bills, an introducers list): drawn at once, scroll and focus kept
hooks7.render = o => o && o.tick ? tick() : render(o);   // Sort new bills: a queue that lands after the page is drawn draws it again the way the minute's tick does (never over a field being typed in)

hooks.toast = m => toast(m);
async function start() {
  if (!DEMO) throw new Error('staff7 is practice-only');   // the second lock, before anything is loaded
  await DB.init(); await DB.loadAll();
  await DB.chairAsks().catch(() => {});   // as the current app's afterLoad: a teammate's recorded ask is known (the practice copy answers with none)
  boot(); seedPublicV7(); initWidth(ctx.me);   // R-398: public mode's practice rules and seeds, once the person is known (after as=); then the width this person left the list at, before the first draw so nothing jumps
  $('toast-slot').innerHTML = toastHTML; wireToast();
  window.addEventListener('hashchange', () => render()); PHONE.addEventListener('change', () => render());
  setInterval(tick, 60000);
  render();
}
start().catch(e => { console.error(e); $('app').innerHTML = '<div class="msg"><h1>We could not load the practice copy</h1><p>Reload the page to try again.</p></div>'; });
