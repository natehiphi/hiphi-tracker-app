// Every bill HIPHI tracks (#/allbills, a row under More; R-091, Nate 9/29). The old staff app's More > "All bills"
// was a spreadsheet of every tracked bill, ordered by where it stood with hearings; Nate asked for it back on the
// public tracker's More. One page of every bill HIPHI took a position on or keeps an eye on this session, grouped by
// hearing status: a hearing scheduled first (soonest first), then waiting in committee (nearest deadline first),
// waiting for a vote, passed the Legislature, became law, and Did not advance folded at the bottom. The rows are My
// issues' shared bill row (pub/mybills.js), so from 1100px the page is a table with a header row (bill, status, next
// date, HIPHI's position) and on a phone the same rows stack. A search box and three filters (topic, HIPHI's position,
// where it stands; Nate 9/29) narrow it without leaving the page. Nothing here is personal: every visitor sees the
// same list.
// B-1: a person comes here to see every bill HIPHI tracks and where each one stands with its hearing.
import { S, D, DEMO, app, esc, icon, nick, plain, alive, stopOf, followYear, findBill, supa, spaced, isResolution, fmtDate, issuesOf } from './core.js';
import { topicOf } from './topics.js';
import { billList, fold, wireRows, byUrgency, numCmp } from './mybills.js';
import { ensureHearings } from './find.js';
import { btn, skeleton, empty } from './ui.js';

const A = S.ab ??= { yr: 0, rows: null, busy: false, err: '', q: '', topic: '', pos: '', stand: '', fOpen: false, all: {},
  hay: new Map(), twins: new Map(), topics: new Map(), grp: new Map() };
const CAP = 40;   // rows shown per group before "Show all": 735 rows at once is a long wait on an older phone
const hasPos = b => !!b.hiphi_position && b.hiphi_position !== 'monitor';

// Where a bill stands, in hearing order. A bill put on hold (deferred) counts as stopped, as it does everywhere else
// on the page (core's alive()); a bill on the Governor's desk or sent to the voters has passed the Legislature.
const GROUPS = [['hear', 'Hearing scheduled'], ['wait', 'Waiting in committee'], ['vote', 'Waiting for a vote'],
  ['passed', 'Passed the Legislature'], ['law', 'Became law'], ['dead', 'Did not advance']];
function groupOf(b) {
  if (b.stage === 'enacted') return 'law';
  if (b.stage === 'governor' || b.stage === 'ballot') return 'passed';
  if (!alive(b)) return 'dead';
  const st = stopOf(b);
  if (st.hearingState === 'scheduled') return 'hear';
  return st.phase === 'committee' ? 'wait' : 'vote';
}
// A bill that became law: the day it did, since its group heading already says "Became law" (the Capitol writes
// "Act 189, on 07/07/2026"; last_action_date is the fallback).
function lawDay(b) {
  const m = /\bon (\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(b.last_action || ''), d = m ? `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}` : String(b.last_action_date || '').slice(0, 10);
  return `${isResolution(b) ? 'Adopted' : 'Signed'}${d ? ' ' + fmtDate(d, { month: 'short', day: 'numeric' }) : ''}`;
}
// House and Senate versions of one idea share a nickname (60 names on 155 bills in 2026); each row names the others.
function altOf(b) {
  const nm = nick(b); if (!nm) return '';
  const others = (A.twins.get(nm) || []).filter(x => x.id !== b.id).sort(numCmp).map(x => spaced(x.bill_number));
  return others.length ? `Another version: ${others.slice(0, 2).join(', ')}${others.length > 2 ? ` and ${others.length - 2} more` : ''}` : '';
}
const posThenNum = list => list.sort((a, b) => hasPos(b) - hasPos(a) || numCmp(a, b));
const ORDER = { hear: byUrgency, wait: byUrgency, vote: posThenNum, passed: posThenNum, law: posThenNum, dead: posThenNum };

// ---- loading: one session's tracked bills, then the hearings of the ones still moving ----
async function fetchYear(yr) {
  if (DEMO) return D.bills.filter(b => b.hiphi_position && (!b.session_year || +b.session_year === yr));
  // Supabase stops at 1,000 rows without saying so; a session has had about 735, so page anyway.
  const sb = await supa(), out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from('public_all_bills').select('*').eq('session_year', yr).not('hiphi_position', 'is', null).order('id').range(from, from + 999);
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < 1000) return out;
  }
}
function load(yr) {
  if (A.busy || (A.yr === yr && A.rows) || (A.yr === yr && A.err)) return;
  A.busy = true; A.err = ''; A.yr = yr;
  (async () => {
    const rows = await fetchYear(yr);
    // Without its hearing a moving bill would read "waiting" when one is set. Asked for in slices at the same time.
    const parts = []; for (let k = 0; k < rows.length; k += 60) parts.push(rows.slice(k, k + 60));
    await Promise.all(parts.map(ensureHearings));
    // So the bill page opens one of these at once instead of asking the database again.
    for (const b of rows) if (!findBill(b.id)) S.extra[b.id] = b;
    A.rows = rows; A.hay.clear(); A.twins.clear(); A.topics.clear(); A.grp.clear();
    for (const b of rows) { const nm = nick(b); if (nm) (A.twins.get(nm) || A.twins.set(nm, []).get(nm)).push(b); }
  })().catch(e => { console.error(e); A.err = 'We couldn’t load the bills.'; }).finally(() => { A.busy = false; app.render(); });
}

// ---- the search: every word must appear in the number, the nickname or what the bill does ----
function hay(b) {
  let h = A.hay.get(b.id);
  if (h === undefined) A.hay.set(b.id, h = plain([b.bill_number, String(b.bill_number).replace(/^(\D+)/, '$1 '), nick(b), b.hiphi_summary, b.title, b.description].join(' ')));
  return h;
}
// ---- the three filters (Nate 9/29: topic, HIPHI's position, where it stands) ----
// A bill's topics are its issues' categories; a bill on no issue (most watched bills) takes the topic the first visit's
// word patterns give it (topics.js, the same keys), else "Other bills". A bill on two issues can be in two topics.
function topicsOf(b) {
  let t = A.topics.get(b.id);
  if (!t) {
    const iss = issuesOf(b);
    t = [...new Set(iss.length ? iss.flatMap(i => i.categories || [i.category]) : [topicOf(b)?.key].filter(Boolean))];
    A.topics.set(b.id, t = t.length ? t : ['other']);
  }
  return t;
}
const standOf = b => { let g = A.grp.get(b.id); if (!g) A.grp.set(b.id, g = groupOf(b)); return g; };
const posKey = b => { const p = b.hiphi_position || ''; return /support/.test(p) ? 'support' : /oppose/.test(p) ? 'oppose' : p === 'neutral' ? 'neutral' : 'monitor'; };
// [state key, label, options () => [[value, words]], test (bill, value)]. The empty value is "all".
const FACETS = [
  ['topic', 'Topic', () => [['', 'All topics'], ...(S.cats || []).map(c => [c.key, c.name]), ['other', 'Other bills']], (b, v) => topicsOf(b).includes(v)],
  ['pos', 'HIPHI’s position', () => [['', 'All positions'], ['side', 'Supports, opposes or comments'], ['support', 'Supports'], ['oppose', 'Opposes'], ['neutral', 'Comments'], ['monitor', 'Watching only']],
    (b, v) => v === 'side' ? hasPos(b) : posKey(b) === v],
  ['stand', 'Where it stands', () => [['', 'Anywhere'], ...GROUPS], (b, v) => standOf(b) === v],
];
const activeN = () => FACETS.filter(([k]) => A[k]).length;
// Every filter but `skip` (for the counts beside a filter's own options: what choosing each one would leave).
function matches(b, skip, words) {
  return words.every(w => hay(b).includes(w)) && FACETS.every(([k, , , test]) => k === skip || !A[k] || test(b, A[k]));
}
const wordsOf = () => plain(A.q).split(/\s+/).filter(Boolean);
function shown() { const w = wordsOf(); return (A.rows || []).filter(b => matches(b, null, w)); }
function filtersHTML() {
  const w = wordsOf();
  const sel = ([k, label, opts, test]) => {
    const base = (A.rows || []).filter(b => matches(b, k, w));
    const o = opts().map(([v, words]) => { const n = v ? base.filter(b => test(b, v)).length : base.length;
      return `<option value="${esc(v)}"${A[k] === v ? ' selected' : ''}${n || A[k] === v ? '' : ' disabled'}>${esc(words)} (${n})</option>`; }).join('');
    return `<div class="field ab-f"><label for="ab-f-${k}">${label}</label><select id="ab-f-${k}" data-ab-f="${k}"${A[k] ? ' class="set"' : ''}>${o}</select></div>`;
  };
  return `${FACETS.map(sel).join('')}${activeN() ? `<div class="ab-fclear">${btn('Clear filters', { kind: 'text', icon: 'x', attrs: { 'data-ab-fclear': '' } })}</div>` : ''}`;
}

function groupsHTML() {
  const list = shown(), by = Object.fromEntries(GROUPS.map(([k]) => [k, []]));
  for (const b of list) by[standOf(b)].push(b);
  const asked = !!A.q.trim() || activeN() > 0;
  if (!list.length) return empty({ title: A.q.trim() ? `No bill matches “${esc(A.q.trim())}”` : asked ? 'No bill fits these filters' : 'No bills here yet',
    text: A.q.trim() ? 'Try a bill number, like HB 1563, or one word, like vaping.' : '', action: asked ? btn(A.q.trim() && activeN() ? 'Clear the search and filters' : A.q.trim() ? 'Clear the search' : 'Clear filters', { kind: 'secondary', attrs: { 'data-ab-clear': '' } }) : '' });
  const opt = k => b => ({ pos: true, watch: true, why: k === 'dead', status: k === 'law' ? lawDay(b) : '', alt: altOf(b) });
  const groups = GROUPS.filter(([k]) => by[k].length);
  return groups.map(([k, title]) => {
    const rows = ORDER[k](by[k]), n = rows.length, cut = A.all[k] ? rows : rows.slice(0, CAP);
    const more = n > cut.length ? `<div class="ab-more">${btn(`Show all ${n}`, { kind: 'secondary', icon: 'chevron-down', attrs: { 'data-ab-all': k } })}</div>` : '';
    const inner = billList(cut, opt(k)) + more;
    const label = `<span>${title} <span class="ab-n">· ${n}</span></span>`;
    // Bills that stopped are the long tail of every session (most of them between sessions): folded, one press away,
    // and open when a search or filter asked for them.
    return k === 'dead' ? fold('ab-dead', label, inner, { ic: 'archive', open: asked })
      : `<section class="ab-grp" aria-labelledby="ab-h-${k}"><div class="sechead"><h2 id="ab-h-${k}">${label}</h2></div>${inner}</section>`;
  }).join('');
}
const countLine = () => { const n = shown().length; return `${n} bill${n === 1 ? '' : 's'}${A.q.trim() || activeN() ? ' match' + (n === 1 ? 'es' : '') : ''}`; };
const fLabel = () => `Filters${activeN() ? ` · ${activeN()}` : ''}`;

function render() {
  const yr = followYear();
  load(yr);
  const head = `<header class="pagehead"><h1 class="hero">Every bill HIPHI tracks</h1>`;
  if (A.err && !A.rows) return `<div class="ab">${head}</header>${empty({ title: A.err, text: 'Check your connection and try again.', action: btn('Try again', { kind: 'primary', attrs: { 'data-ab-retry': '' } }) })}</div>`;
  if (!A.rows || A.yr !== yr) return `<div class="ab">${head}</header>${skeleton(6)}</div>`;
  const n = A.rows.length, open = A.fOpen || activeN() > 0;
  // One line on a phone, so the first bill starts high (DESIGN A-1).
  const lede = n ? `${yr} session · ${n} bills` : `HIPHI hasn’t added its ${yr} bills yet.`;
  // On a phone the filters wait behind one button (open by itself while one is set, so a person sees what narrowed
  // the list); from 900px they are always a row above the table and the button is hidden.
  return `<div class="ab">
    <div class="ab-top">${head}<p class="lede">${lede}</p></header>
    ${n ? `<div class="ab-tools" role="search">
      <div class="ab-q"><label class="sr" for="ab-q">Search these bills</label>${icon('search')}<input id="ab-q" class="input" type="search" placeholder="Search by name or number" value="${esc(A.q)}" autocomplete="off" enterkeyhint="search"></div>
      <button type="button" class="btn secondary ab-fbtn" aria-expanded="${open}" aria-controls="ab-filters" data-ab-fbtn>${icon('sliders-horizontal')}<span>${fLabel()}</span></button>
    </div>` : ''}</div>
    ${n ? `<div class="ab-filters${open ? '' : ' shut'}" id="ab-filters">${filtersHTML()}</div>
    <p class="sr" id="ab-count" aria-live="polite">${countLine()}</p>` : ''}
    <div id="ab-list">${n ? groupsHTML() : ''}</div>
  </div>`;
}

// A search or a filter redraws only the list and the filter counts, so the box or the dropdown keeps its focus.
function redrawList() {
  const box = document.getElementById('ab-list'); if (!box) return;
  box.innerHTML = groupsHTML(); wireList(box);
  const f = document.getElementById('ab-filters');
  if (f) { const had = document.activeElement?.id; f.innerHTML = filtersHTML(); wireFilters(f); if (had && f.querySelector('#' + had)) document.getElementById(had).focus(); }
  const fb = document.querySelector('[data-ab-fbtn]'); if (fb) { fb.querySelector('span').textContent = fLabel(); }
  const c = document.getElementById('ab-count'); if (c) c.textContent = countLine();
}
const clearFilters = () => { for (const [k] of FACETS) A[k] = ''; A.all = {}; };
function wireFilters(root) {
  root.querySelectorAll('[data-ab-f]').forEach(el => el.addEventListener('change', () => { A[el.dataset.abF] = el.value; A.all = {}; redrawList(); }));
  root.querySelector('[data-ab-fclear]')?.addEventListener('click', () => { clearFilters(); redrawList(); document.getElementById('ab-f-topic')?.focus(); });
}
function wireList(root) {
  wireRows(root);
  root.querySelectorAll('[data-ab-all]').forEach(el => el.onclick = () => { A.all[el.dataset.abAll] = true; redrawList(); });
  root.querySelector('[data-ab-clear]')?.addEventListener('click', () => { A.q = ''; clearFilters(); const q = document.getElementById('ab-q'); if (q) { q.value = ''; q.focus(); } redrawList(); });
}
let timer = 0;
function wire() {
  const main = document.getElementById('main') || document;
  main.querySelector('[data-ab-retry]')?.addEventListener('click', () => { A.err = ''; A.yr = 0; app.render(); });
  const q = document.getElementById('ab-q');
  if (q) q.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => { A.q = q.value; A.all = {}; redrawList(); }, 150); });
  const fb = main.querySelector('[data-ab-fbtn]'), f = document.getElementById('ab-filters');
  if (fb && f) fb.addEventListener('click', () => { A.fOpen = f.classList.contains('shut'); f.classList.toggle('shut', !A.fOpen); fb.setAttribute('aria-expanded', String(A.fOpen)); if (A.fOpen) f.querySelector('select')?.focus(); });
  if (f) wireFilters(f);
  const list = document.getElementById('ab-list'); if (list) wireList(list);
}

export default { tab: 'more', title: () => 'Every bill HIPHI tracks', render, wire };
