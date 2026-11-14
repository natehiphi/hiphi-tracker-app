// Staff7: boots the practice data, routes between Home, a step and its done moment, and draws the frame (doors, left list, right sheet).
import { S, DB, DEMO, hooks, advocate } from '../staff6/data.js';
import { stepsFor, homeRows, BUILT, hearingLine, dayTime, left } from './steps.js';
import { stepRow, dueStrip, band, plainBand, btn, esc, toast, wireToast, toastHTML } from './parts.js';
import { writeSheet, bindWrite, sendStep, undoSend } from './do_write.js';
import { doneSheet, bindDone, stopDone } from './done.js';
import { ic } from './icons7.js';

const $ = id => document.getElementById(id);
const PHONE = matchMedia('(max-width: 899px)');
const DOORS = [['home', 'Home', 'house', '#/'], ['issues', 'Issues', 'layers', '#/issues'], ['calendar', 'Calendar', 'calendar', '#/calendar'], ['search', 'Search', 'search', '#/search'], ['explore', 'Explore', 'layout-grid', '#/explore']];
const WILL = { issues: 'Your issues and your teammates’, with every bill on each.', calendar: 'The week’s hearings and deadlines, in one place.', search: 'Go straight to a bill, a person, an issue or a place.', explore: 'Every other place in the app, with one line on what each is for.' };

// Session memory: what is typed, and what is finished, live here and nowhere else. The practice copy keeps its data writes in this tab too.
const ctx = { me: null, letters: {}, finished: {},
  open() { return stepsFor(ctx.me).filter(s => !ctx.finished[s.id] || ctx.finished[s.id].undone); },
  async send(s) { const undo = await sendStep(s); ctx.finished[s.id] = { step: s, at: Date.now(), undo }; location.hash = '#/done/' + s.id; },
  async undo(id) { const f = ctx.finished[id]; if (!f) return; await undoSend(f.undo); delete ctx.finished[id]; location.hash = '#/do/' + id; toast('Undone. Nothing was sent, and your words are back.', { ms: 5000 }); } };

function boot() {
  const as = new URLSearchParams(location.search).get('as');
  const a = as && S.advocates.find(x => (x.initials || '').toUpperCase() === as.toUpperCase());
  if (a) { S.me = a; S.follows = new Set(Object.entries(S.followersBy || {}).filter(([, ids]) => ids.includes(a.id)).map(([id]) => id)); }
  ctx.me = S.me;
}

// ---- routing ----
function parse() {
  const [a, ...r] = location.hash.replace(/^#\/?/, '').split('/');
  const id = decodeURIComponent(r.join('/'));
  if (a === 'do' && id) return { r: 'do', id };
  if (a === 'done' && id) return { r: 'done', id };
  if (WILL[a]) return { r: 'door', door: a };
  return { r: 'home' };
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
  h += rows.length ? `<section aria-labelledby="hs"><h3 class="lh" id="hs">Your steps</h3><ul class="srows3">${rows.map(s => stepRow(s, s.id === openId)).join('')}</ul></section>`
    : '<p class="calmnote">Nothing needs you.</p>';
  return h;
}

// ---- the sheets ----
const SUN = '<svg class="calm-pic" viewBox="0 0 96 48" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 40h88"/><path d="M26 40a22 22 0 0 1 44 0"/><path d="M48 6v6M20 16l4 4M76 16l-4 4"/></svg>';
function calmSheet() {
  return `<div class="pn"><div class="hband neutral"><div class="calm-hd">${SUN}<div class="ht"><h1 tabindex="-1">Nothing needs you</h1><p class="bsub">When a step comes up, it will be here first.</p></div></div></div>`
    + `<div class="pbody"><p class="lead">No letters to write, approve or file, and no hearing to ask for.</p><div class="sfoot plain">${btn('Open Calendar', { kind: 'filled', href: '#/calendar' })}<span class="fnote">See the week’s hearings.</span></div></div></div>`;
}
function doorSheet(k) {
  const name = DOORS.find(d => d[0] === k)[1];
  return `<div class="pn">${plainBand(name, WILL[k])}<div class="pbody"><p class="lead"><span class="stmark">${ic('clock')}<span>Not built yet</span></span></p><p class="lead">This place is coming. Your steps are on Home.</p><div class="sfoot plain">${btn('Back to Home', { kind: 'filled', href: '#/' })}</div></div></div>`;
}
function unbuiltSheet(s) {
  return `<div class="pn">${band(s.issue, s.verb, s.name, s.no)}<div class="pbody">${dueStrip(s, hearingLine(s.hearing))}<p class="lead">This step’s page is being built.</p>`
    + `<dl class="facts"><dt>Bill</dt><dd>${esc(s.name)} <span class="no">${esc(s.no)}</span></dd><dt>Due</dt><dd>${esc(dayTime(s.dueAt))}, in ${esc(left(s.dueAt))}</dd>${s.hearing ? `<dt>Hearing</dt><dd>${esc(hearingLine(s.hearing).replace(/^Hearing /, ''))}</dd>` : ''}</dl>`
    + `<div class="sfoot plain">${btn('Back to Home', { kind: 'filled', href: '#/' })}</div></div></div>`;
}
const missingSheet = () => `<div class="pn">${plainBand('That step is not here', 'It may be finished, or it may belong to someone else.')}<div class="pbody"><div class="sfoot plain">${btn('Back to Home', { kind: 'filled', href: '#/' })}</div></div></div>`;

// ---- draw ----
let lastRoute = '', first = true;
function render() {
  stopDone();
  const rt = parse(), rows = homeRows(ctx.open());
  let sheet = '', openId = '', bindFn = null, cur = 'home', one = false, bare = false;
  if (rt.r === 'home') {
    const s = rows[0]; openId = s?.id || '';
    sheet = !s ? calmSheet() : BUILT.has(s.kind) ? writeSheet(s, ctx) : unbuiltSheet(s);
    if (s && BUILT.has(s.kind)) bindFn = () => bindWrite(s, ctx);
  } else if (rt.r === 'do') {
    const s = ctx.open().find(x => x.id === rt.id); openId = s?.id || '';
    sheet = !s ? missingSheet() : BUILT.has(s.kind) ? writeSheet(s, ctx) : unbuiltSheet(s);
    if (s && BUILT.has(s.kind)) bindFn = () => bindWrite(s, ctx);
  } else if (rt.r === 'done') {
    sheet = doneSheet(ctx, rt.id) || missingSheet(); bindFn = () => bindDone(ctx, rt.id);
  } else { cur = rt.door; sheet = doorSheet(rt.door); one = true; }
  const phone = PHONE.matches, onHome = rt.r === 'home';
  const cls = `ws${one ? ' one' : ''}${phone ? (onHome ? ' listonly' : ' sheetonly') : ''}`;
  const showList = !one, stepPage = rt.r === 'do' || rt.r === 'done';
  document.body.classList.add('isws', 'hasbar'); document.body.classList.toggle('nobar', phone && stepPage);
  $('bar-slot').innerHTML = bar(cur); $('bar-slot').firstElementChild.classList.toggle('off', phone && stepPage);
  $('app').innerHTML = `<div class="${cls}">${showList ? `<div class="wl">${listCol(rows, openId, phone && onHome)}</div>` : ''}<div class="wp"><a class="back backhome" href="#/">${ic('chevron-left')}Back to Home</a><div class="paper enter" role="region" aria-label="${one ? DOORS.find(d => d[0] === rt.door)[1] : 'Step'}">${sheet}</div></div></div>`;
  if (phone) document.body.classList.remove('isws');
  bindFn && bindFn();
  const key = location.hash;
  if (!first && key !== lastRoute) { const h1 = document.querySelector('main h1'); h1 && h1.focus({ preventScroll: true }); window.scrollTo(0, 0); }
  first = false; lastRoute = key;
}

hooks.toast = m => toast(m);
async function start() {
  await DB.init(); await DB.loadAll();
  boot();
  $('toast-slot').innerHTML = toastHTML; wireToast();
  window.addEventListener('hashchange', render); PHONE.addEventListener('change', render);
  render();
  document.documentElement.dataset.ready = '1';
}
start().catch(e => { console.error(e); $('app').innerHTML = '<div class="page"><h1>We could not load the practice copy</h1><p>Reload the page to try again.</p></div>'; });
