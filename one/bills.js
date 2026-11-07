// Bills (R-360 part 4, #/bills): every bill HIPHI has a position on, inside its issues. Nate's structure of 6 Nov: issues are
// the unit people follow, and bills live within issues. From the top: a search (name or number; the box filters as you
// type, and Search is an outlined button for those who look for one), HIPHI's topics as chips, "Needs voices this week"
// (as Home names it: up to five bills whose testimony closes before the week is out, or "Needs voices soon" with the next
// ones when none does), then one section per issue with a quiet Follow, its bills needing voices first, four shown and
// "Show N more".
// Bills with no issue come last, under "Other bills".
// Following an issue here writes the tracker's own key (pub/kernel.js ISSUES_KEY: a list of issue ids, hiphi_issue_follows,
// or hiphi_issue_follows_demo in the practice copy), so an issue followed here shows as followed in track.html, and the
// other way round. A whole topic followed there (CATS_KEY) shows here as each of its issues followed.
// #/bills/<issue-slug> opens the screen at that issue (the bill screen's "Part of ..." line).
import { issueBand } from '../pub/art.js';
import { icon } from '../icons.js';
import { t } from './i18n.js';
import { DEMO } from './data.js';
import { esc, header, keepHyphens } from './bill.js';
import { sendBy, capitolWeek } from './words.js';
import { tabs } from './tabs.js';

export const ISSUES_KEY = DEMO ? 'hiphi_issue_follows_demo' : 'hiphi_issue_follows';
export const CATS_KEY = DEMO ? 'hiphi_cat_follows_demo' : 'hiphi_cat_follows';
export const readSet = k => { try { return new Set(JSON.parse(localStorage.getItem(k) || '[]')); } catch { return new Set(); } };
const writeSet = (k, s) => { try { localStorage.setItem(k, JSON.stringify([...s])); } catch { /* private mode: followed for this visit only */ } };
export const followed = i => readSet(ISSUES_KEY).has(i.id) || i.categories.some(c => readSet(CATS_KEY).has(c));
// As pub/core.js unfollowIssue: an issue followed through its whole topic stops the topic and keeps its other issues.
// Following anything at all (This week, part 5: a returning person lands there).
export const followsAny = () => readSet(ISSUES_KEY).size > 0 || readSet(CATS_KEY).size > 0;
function setFollow(i, on, L) {
  const is = readSet(ISSUES_KEY), cs = readSet(CATS_KEY);
  if (on) is.add(i.id);
  else {
    is.delete(i.id);
    for (const c of i.categories.filter(c => cs.has(c))) { cs.delete(c); for (const x of L.issues) if (x.id !== i.id && x.categories.includes(c)) is.add(x.id); }
    writeSet(CATS_KEY, cs);
  }
  writeSet(ISSUES_KEY, is);
}

// What the screen remembers, so Back from a bill, or a reload, finds it as it was (B-6): the search, the topic, the issues
// opened with "Show N more" and where it was scrolled to. Kept for the visit in sessionStorage (the practice copy under its
// own key, so practising never changes what the real screen remembers).
const KEEP = DEMO ? 'hiphi_act_bills_demo' : 'hiphi_act_bills';
export const state = (() => {
  try { const x = JSON.parse(sessionStorage.getItem(KEEP) || 'null');
    if (x) return { q: String(x.q || ''), topic: String(x.topic || ''), open: new Set(Array.isArray(x.open) ? x.open : []), y: +x.y || 0 }; }
  catch { /* storage blocked: the screen starts afresh */ }
  return { q: '', topic: '', open: new Set(), y: 0 };
})();
export const keep = () => { try { sessionStorage.setItem(KEEP, JSON.stringify({ ...state, open: [...state.open] })); } catch { /* kept for this page only */ } };
// Where the list is scrolled to, kept as the person scrolls (only while Bills is the screen drawn).
let scrollT = 0;
addEventListener('scroll', () => {
  if (!document.getElementById('b-res')) return;
  clearTimeout(scrollT);
  scrollT = setTimeout(() => { if (document.getElementById('b-res')) { state.y = Math.round(scrollY); keep(); } }, 150);
}, { passive: true });
const SHOW = 4, VOICES = 5;
// One quiet line for a bill with no testimony open. C-15's words: "did not advance", never "dead".
const statusOf = b => b.stage === 'enacted' ? t('bills.law') : b.stage === 'governor' ? t('bills.gov') : b.stage === 'ballot' ? t('bills.ballot') : b.alive ? t('bills.moving') : t('bills.over');

const chev = icon('chevron-right', { size: '18px', cls: 'chev' });
// A row's name: the bill's name, or under its issue its number (alone when the issue already says the name).
export const rowName = (b, issue = null) => issue && b.nickname && b.nickname.toLowerCase() === issue.name.toLowerCase() ? b.numberSpaced : issue ? `${b.numberSpaced}: ${b.name}` : b.name;
// A row: the bill's name, then the deadline or where it stands.
function row(b, L, issue = null) {
  const d = b.due ? sendBy(b.due, L.now) : null;
  const name = rowName(b, issue);
  return `<a class="r" href="#/${esc(b.number)}" data-bill="${esc(b.number)}"${b.due ? ` data-due="${esc(b.due)}"` : ''}><span class="t"><b>${keepHyphens(name)}</b>`
    + `<span${d ? ` class="due${d.soon ? ' soon' : ''}"` : ''}>${esc(d ? d.text : statusOf(b))}</span></span>${chev}</a>`;
}
// Within an issue: testimony open first, soonest first; then bills still moving, then the ones that became law, then the rest.
const rank = b => b.due ? 0 : b.alive ? 1 : b.stage === 'enacted' ? 2 : 3;
export const byNum = (x, y) => x.number.localeCompare(y.number, 'en', { numeric: true });
const order = bs => bs.slice().sort((x, y) => rank(x) - rank(y) || (x.due && y.due ? x.due.localeCompare(y.due) : 0) || byNum(x, y));

// Search: a bill number in any spacing ("hb2121", "HB 2121") or words of a bill's or an issue's name. HIPHI writes
// "e-cigarettes", never "vape" (R-158), but a search for vape still finds them.
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯʻ']/g, '').replace(/\bvap(e|es|ing)?\b/g, 'e-cig');
function matcher(q) {
  const n = norm(q).trim(); if (!n) return null;
  const num = n.replace(/\s+/g, '');
  const words = n.split(/\s+/).filter(Boolean);
  const has = s => { const h = norm(s); return words.every(w => h.includes(w)); };
  return { bill: b => (/^[a-z]{1,3}\d+$/.test(num) && b.number.toLowerCase().startsWith(num)) || has(`${b.nickname} ${b.name}`), issue: i => has(i.name) };
}

// The screen's lists, for the topic and search chosen.
function sections(L) {
  const m = matcher(state.q), inTopic = i => !state.topic || i.categories.includes(state.topic);
  const known = new Set(L.issues.map(i => i.id)), billsOf = new Map();
  for (const b of L.bills) for (const id of b.issues) if (known.has(id)) (billsOf.get(id) || billsOf.set(id, []).get(id)).push(b);
  const catOrder = new Map(L.cats.map((c, k) => [c.key, k]));
  const issues = L.issues.filter(i => inTopic(i) && billsOf.has(i.id))
    .sort((x, y) => (catOrder.get(x.category) ?? 99) - (catOrder.get(y.category) ?? 99) || x.sort_order - y.sort_order || x.name.localeCompare(y.name))
    .map(i => ({ i, bills: order(!m || m.issue(i) ? billsOf.get(i.id) : billsOf.get(i.id).filter(m.bill)) })).filter(s => s.bills.length);
  const other = state.topic ? [] : order(L.bills.filter(b => !b.issues.some(id => known.has(id)) && (!m || m.bill(b))));
  // Needs voices this week: across the issues in view, the bills whose testimony closes before the week is out, soonest first;
  // with none this week, "Needs voices soon" and the next ones (none while searching: the matches are the list).
  const seen = new Set(), open = m ? [] : [...issues.flatMap(s => s.bills), ...other].filter(b => b.due && !seen.has(b.id) && seen.add(b.id))
    .sort((x, y) => x.due.localeCompare(y.due));
  const end = capitolWeek(L.now).endIso, week = open.filter(b => b.due < end);
  const voices = (week.length ? week : open).slice(0, VOICES), soonOnly = !week.length;
  return { issues, other, voices, soonOnly, count: new Set([...issues.flatMap(s => s.bills), ...other].map(b => b.id)).size, searching: !!m };
}

function issueSection({ i, bills }, L) {
  const open = state.open.has(i.id) || bills.length <= SHOW + 1, shown = open ? bills : bills.slice(0, SHOW), on = followed(i);
  const band = issueBand(i, true), th = band.startsWith('<img') ? `<span class="th">${band}</span>` : '';
  const cat = !state.topic ? L.cats.find(c => c.key === i.category)?.name : '';
  return `<section class="isec" id="issue-${esc(i.slug)}" aria-labelledby="ih-${esc(i.slug)}"><div class="iss">${th}<span class="nm"><h3 id="ih-${esc(i.slug)}" tabindex="-1">${keepHyphens(i.name)}</h3>${cat ? `<span class="lab">${esc(cat)}</span>` : ''}</span>`
    + `<button class="follow" type="button" data-follow="${esc(i.id)}" aria-pressed="${on}" aria-label="${esc(t(on ? 'bills.following.label' : 'bills.follow.label', { name: i.name }))}">${on ? `<span>${esc(t('bills.following'))}</span>${icon('check', { size: '16px' })}` : esc(t('bills.follow'))}</button></div>`
    + `<div class="rows">${shown.map(b => row(b, L, i)).join('')}${open ? '' : `<button class="r more" type="button" data-more="${esc(i.id)}"><span class="t"><span>${esc(t('bills.more', { n: bills.length - SHOW }))}</span></span>${icon('chevron-down', { size: '18px', cls: 'chev' })}</button>`}</div></section>`;
}

function results(L) {
  const S = sections(L);
  if (!S.issues.length && !S.other.length) return `<p class="empty" role="status">${esc(t(S.searching ? 'bills.none' : 'bills.none.topic'))}</p>`;
  return (S.searching ? `<p class="found" role="status">${esc(t(S.count === 1 ? 'bills.found.one' : 'bills.found', { n: S.count }))}</p>` : '')
    + (S.voices.length ? `<section class="voices" aria-labelledby="bv-h"><h2 class="sec" id="bv-h">${esc(t(S.soonOnly ? 'bills.voices.soon' : 'home.voices'))}</h2><div class="rows">${S.voices.map(b => row(b, L)).join('')}</div></section>` : '')
    + (S.issues.length ? `<h2 class="sec">${esc(t('bills.byissue'))}</h2>${S.issues.map(s => issueSection(s, L)).join('')}` : '')
    + (S.other.length ? `<section class="isec" id="issue-other" aria-labelledby="ih-other"><div class="iss"><span class="nm"><h3 id="ih-other" tabindex="-1">${esc(t('bills.other'))}</h3></span></div>`
      + `<div class="rows">${(state.open.has('other') || S.other.length <= SHOW + 1 ? S.other : S.other.slice(0, SHOW)).map(b => row(b, L)).join('')}`
      + `${state.open.has('other') || S.other.length <= SHOW + 1 ? '' : `<button class="r more" type="button" data-more="other"><span class="t"><span>${esc(t('bills.more', { n: S.other.length - SHOW }))}</span></span>${icon('chevron-down', { size: '18px', cls: 'chev' })}</button>`}</div></section>` : '');
}

const chips = L => [{ key: '', name: t('bills.all') }, ...L.cats].map(c => `<button class="chip" type="button" data-topic="${esc(c.key)}" aria-pressed="${state.topic === c.key}">${esc(c.name)}</button>`).join('');

// Bills has no filled (primary) button, on purpose (R-360 fix pass): the box filters as the person types, so Search is only
// a secondary, outlined button for those who look for one, and the screen's job is to browse, not one action (A-3 allows
// a screen with no primary; the bill screen a row opens has the one action).
export function billsScreen(L) {
  return `${header(null, { slim: true })}<main class="sheet bills" id="main">
    <h1 tabindex="-1">${esc(t('bills.h'))}</h1>
    <form class="find" role="search" data-find>
      <label class="box">${icon('search', { size: '18px' })}<span class="sr">${esc(t('bills.search.label'))}</span>
        <input id="b-q" type="search" value="${esc(state.q)}" placeholder="${esc(t('bills.search.ph'))}" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search"></label>
      <button class="secondary" type="submit">${esc(t('bills.search'))}</button>
    </form>
    <div class="chips" role="group" aria-label="${esc(t('bills.topics'))}">${chips(L)}</div>
    <div id="b-res">${results(L)}</div>
  </main>${tabs('bills')}`;
}
export const billsLoading = () => `${header(null, { slim: true })}<main class="sheet bills" id="main" aria-busy="true"><h1 tabindex="-1">${esc(t('bills.h'))}</h1><p class="sr">${esc(t('bills.loading'))}</p>
  <div class="bar h w100"></div><div class="bar w60"></div><div class="bar w100"></div><div class="bar w90"></div><div class="bar w80"></div></main>${tabs('bills')}`;

// The screen's taps. Search and the chips redraw only the results, so the box keeps the focus and the keyboard stays up.
export function wireBills(root, L) {
  const res = root.querySelector('#b-res'), input = root.querySelector('#b-q');
  const redraw = () => { res.innerHTML = results(L); };
  input.addEventListener('input', () => { state.q = input.value; redraw(); keep(); });
  root.querySelector('[data-find]').addEventListener('submit', e => {
    e.preventDefault(); state.q = input.value; redraw(); keep(); input.blur();   // the keyboard goes down, so the results can be seen
    res.scrollIntoView({ block: 'start', behavior: 'instant' });   // the count or "No bill matches" is a status line: a screen reader says it
  });
  root.querySelector('.chips').addEventListener('click', e => {
    const c = e.target.closest('[data-topic]'); if (!c) return;
    state.topic = c.dataset.topic; state.open.clear(); keep();
    root.querySelectorAll('[data-topic]').forEach(x => x.setAttribute('aria-pressed', String(x === c)));
    redraw();
  });
  res.addEventListener('click', e => {
    const f = e.target.closest('[data-follow]');
    if (f) { const i = L.issues.find(x => x.id === f.dataset.follow); if (!i) return;
      setFollow(i, !followed(i), L); redraw(); res.querySelector(`[data-follow="${CSS.escape(i.id)}"]`)?.focus(); return; }
    const m = e.target.closest('[data-more]');
    if (m) { const id = m.dataset.more, sec = m.closest('.isec'), k = sec.querySelectorAll('a.r').length;
      state.open.add(id); redraw(); keep();
      res.querySelector(`#${CSS.escape(sec.id)} a.r:nth-of-type(${k + 1})`)?.focus();   // the first bill just shown
      return; }
    if (e.target.closest('a.r')) { state.y = Math.round(window.scrollY); keep(); }   // Back finds the list where it was
  });
}
// Open at an issue (#/bills/<slug>): every topic, no search, the issue's bills all shown, scrolled so its heading is at the top.
export function atIssue(root, slug) {
  const sec = root.querySelector(`#issue-${CSS.escape(slug)}`);
  if (!sec) return false;
  sec.scrollIntoView({ block: 'start', behavior: 'instant' });
  sec.querySelector('h3')?.focus({ preventScroll: true });
  return true;
}
