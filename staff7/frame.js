// Staff7's frame: boots the practice data, routes between Home, a step and its done moment, and draws the doors, the left list and the right sheet.
import { S, DB, DEMO, hooks, savePractice } from '../staff6/data.js';
import { stepsFor, homeRows, BUILT, hearingLine, left } from './steps.js';
import { stepRow, dueStrip, band, plainBand, btn, esc, toast, clearToast, wireToast, toastHTML } from './parts.js';
import { writeSheet, bindWrite, sendStep, undoSend } from './do_write.js';
import { approveSheet, bindApprove, approveStep, undoApprove, sendBackNow } from './do_approve.js';
import { fileSheet, bindFile, fileStep, undoFile } from './do_file.js';
import { askSheet, bindAsk, askStep, undoAsk } from './do_ask.js';
import { missedSheet, bindMissed, notFiledStep } from './do_missed.js';
import { doneSheet, bindDone, stopDone, UNDO_MS } from './done.js';
import { ic } from './icons7.js';

const $ = id => document.getElementById(id);
const PHONE = matchMedia('(max-width: 899px)');
const DOORS = [['home', 'Home', 'house', '#/'], ['issues', 'Issues', 'layers', '#/issues'], ['calendar', 'Calendar', 'calendar', '#/calendar'], ['search', 'Search', 'search', '#/search'], ['explore', 'Explore', 'layout-grid', '#/explore']];
const WILL = { issues: 'Your issues and your teammates’, with every bill on each.', calendar: 'The week’s hearings and deadlines, in one place.', search: 'Go straight to a bill, a person, an issue or a place.', explore: 'Every other place in the app, with one line on what each is for.' };

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
  askIt: s => ctx.guard(s, async () => { ctx.finish(s, 'asked', { undo: await askStep(s) }); }),
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
    delete ctx.finished[id]; ctx.setStage(id, 1); location.hash = '#/do/' + encodeURIComponent(id);
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
  const [a, ...r] = location.hash.replace(/^#\/?/, '').split('/');
  let id = ''; try { id = decodeURIComponent(r.join('/')); } catch { return { r: 'missing' }; }
  if (a === 'do' || a === 'done') return id ? { r: a, id } : { r: 'missing' };
  if (a && Object.hasOwn(WILL, a)) return { r: 'door', door: a };
  return a ? { r: 'missing' } : { r: 'home' };
}

// ---- the frame ----
const bar = cur => `<nav class="bar" aria-label="Main"><a class="brand" href="#/" aria-label="HIPHI Tracker, Home">H</a><ul>${DOORS.map(([k, n, i, h]) =>
  `<li><a class="bi"${k === cur ? ' aria-current="page"' : ''} href="${h}"><span class="rpill">${ic(i)}</span><span>${n}</span></a></li>`).join('')}</ul>`
  + `<span class="who"><span class="person" title="${esc(ctx.me?.full_name)}" role="img" aria-label="Signed in as ${esc(ctx.me?.full_name)}">${esc(ctx.me?.initials)}</span><span class="prac">Practice</span></span></nav>`;

function greeting() {
  const hr = +new Date().toLocaleTimeString('en-US', { timeZone: 'Pacific/Honolulu', hour: 'numeric', hour12: false });
  const day = new Date().toLocaleDateString('en-US', { timeZone: 'Pacific/Honolulu', weekday: 'long', month: 'long', day: 'numeric' });
  return `${day} · Good ${hr < 12 ? 'morning' : hr < 17 ? 'afternoon' : 'evening'}, ${esc((ctx.me?.full_name || '').split(' ')[0])}`;
}
function listCol(rows, openId, asH1) {
  const t = asH1 ? 'h1' : 'h2';
  let h = `<header><${t} class="gdate"${asH1 ? ' tabindex="-1"' : ''}>${greeting()}</${t}></header>`;
  if (rows.length) h += `<section aria-labelledby="hs"><h3 class="lh" id="hs">Your steps</h3><ul class="srows3">${rows.map(s => stepRow(s, s.id === openId)).join('')}</ul></section>`;
  return h;
}

// ---- the sheets ----
const SUN = '<svg class="calm-pic" viewBox="0 0 96 48" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 40h88"/><path d="M26 40a22 22 0 0 1 44 0"/><path d="M48 6v6M20 16l4 4M76 16l-4 4"/></svg>';
const calmSheet = () => `<div class="pn"><div class="hband neutral"><div class="calm-hd">${SUN}<div class="ht"><h1 tabindex="-1">Nothing needs you.</h1></div></div></div></div>`;
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
let lastRoute = '', first = true;
function render(opts = {}) {
  stopDone(); clearInterval(ctx.pollT);
  const keepScroll = opts.tick ? [...document.querySelectorAll('.wl, .paper')].map(e => [e, e.scrollTop]) : [], tpOpen = opts.tick && !!document.getElementById('tpList') && !document.getElementById('tpList').hidden;
  const had = document.activeElement && document.activeElement.id;
  if (ctx.unknown) { $('bar-slot').innerHTML = ''; $('app').innerHTML = `<div class="ws one"><div class="wp"><div class="paper">${peopleSheet()}</div></div></div>`; document.documentElement.dataset.ready = '1'; return; }
  const rt = parse(), rows = homeRows(ctx.open()), phone = PHONE.matches;
  let sheet = '', openId = '', bindFn = null, cur = 'home', one = false;
  if (rt.r === 'home') {
    const s = rows[0]; openId = s?.id || '';
    if (!s) sheet = calmSheet(); else [sheet, bindFn] = sheetFor(s);
  } else if (rt.r === 'do') {
    const s = ctx.open().find(x => x.id === rt.id); openId = s?.id || '';
    if (!s) sheet = missingSheet(); else [sheet, bindFn] = sheetFor(s);
  } else if (rt.r === 'done') {
    sheet = doneSheet(ctx, rt.id, freshDraft) || missingSheet(); bindFn = () => bindDone(ctx, rt.id);
  } else if (rt.r === 'door') { cur = rt.door; sheet = doorSheet(rt.door); one = true; }
  else sheet = missingSheet();
  const onHome = rt.r === 'home', stepPage = rt.r === 'do' || rt.r === 'done' || rt.r === 'missing';
  const cls = `ws${one ? ' one' : ''}${phone ? (onHome ? ' listonly' : ' sheetonly') : ''}`;
  document.body.classList.add('isws', 'hasbar'); document.body.classList.toggle('nobar', phone && stepPage);
  $('bar-slot').innerHTML = bar(cur); $('bar-slot').firstElementChild.classList.toggle('off', phone && stepPage);
  $('app').innerHTML = `<div class="${cls}">${one ? '' : `<div class="wl">${listCol(rows, phone && onHome ? '' : openId, phone && onHome)}</div>`}<div class="wp"><a class="back backhome" href="#/">${ic('chevron-left')}Back to Home</a><div class="paper enter" role="region" aria-label="${one ? esc(DOORS.find(d => d[0] === rt.door)[1]) : 'Step'}">${sheet}</div></div></div>`;
  if (phone) document.body.classList.remove('isws');
  bindFn && bindFn();
  if (opts.tick) {   // a tick changes only the numbers: no entry animation, same scroll, talking points as they were
    document.querySelectorAll('#app .enter').forEach(e => e.classList.remove('enter'));
    const tl = document.getElementById('tpList'), tb = document.getElementById('tpBtn'); if (tpOpen && tl) { tl.hidden = false; tb?.setAttribute('aria-expanded', 'true'); }
    keepScroll.forEach(([e, y]) => { const n = e.classList.contains('wl') ? document.querySelector('.wl') : document.querySelector('.paper'); if (n) n.scrollTop = y; });
  }
  if (location.hash !== lastRoute) clearToast();   // a toast belongs to the page it was said on
  const key = location.hash, vis = sel => [...document.querySelectorAll(sel)].find(e => e.getBoundingClientRect().width > 0);
  const target = (opts.focus && vis(opts.focus)) || (opts.tick && had && document.getElementById(had));
  if (target) target.focus({ preventScroll: true });
  else if (!first && (key !== lastRoute || !document.activeElement || document.activeElement === document.body)) { const h1 = vis('main h1'); h1 && h1.focus({ preventScroll: true }); if (key !== lastRoute) window.scrollTo(0, 0); }
  if (!opts.tick && (!document.activeElement || document.activeElement === document.body)) { const h1 = vis('main h1'); h1 && h1.focus({ preventScroll: true }); }   // focus never drops to the page body
  first = false; lastRoute = key; document.documentElement.dataset.ready = '1';
}

// The times tick: drawn again each minute and on coming back to the tab, only when nothing is being typed, held or sent.
function tick() {
  const a = document.activeElement, field = a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName), tst = document.getElementById('toast');
  const quiet = field || document.querySelector('#sbBox:not([hidden]), .errt:not([hidden])') || (tst?.classList.contains('on') && !document.getElementById('toastUndo').hidden);
  if (document.visibilityState !== 'visible' || quiet || held() || ctx.busy.size || document.querySelector('.is-loading') || !/^(|#|#\/|#\/do\/.*)$/.test(location.hash)) return;
  render({ tick: true });
}
window.__staff7Tick = tick;   // the tests call the minute's redraw directly

hooks.toast = m => toast(m);
async function start() {
  if (!DEMO) throw new Error('staff7 is practice-only');   // the second lock, before anything is loaded
  await DB.init(); await DB.loadAll();
  await DB.chairAsks().catch(() => {});   // as the current app's afterLoad: a teammate's recorded ask is known (the practice copy answers with none)
  boot();
  $('toast-slot').innerHTML = toastHTML; wireToast();
  window.addEventListener('hashchange', () => render()); PHONE.addEventListener('change', () => render());
  setInterval(tick, 60000);
  render();
}
start().catch(e => { console.error(e); $('app').innerHTML = '<div class="msg"><h1>We could not load the practice copy</h1><p>Reload the page to try again.</p></div>'; });
