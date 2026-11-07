// Version 3 (?v3=1, R-362 Part 4): Find as every bill HIPHI works on, inside its issues (the #/find route). act.html's Bills
// (one/bills.js, R-360 part 4; Nate's structure of 6 Nov: issues are the unit people follow, and bills live within issues), with
// the layout and the words ported and the data rewritten over core.js and the live search (find.js).
// From the top: the search box (find.js's own search: its synonyms, so "vape" finds the e-cigarette bills, and bill numbers in
// any spacing); HIPHI's topics as chips (aria-pressed); "Needs voices this week", up to five bills from the ranking behind
// today's Find (core.js recommendations) with a hearing inside the week; one section per issue with a quiet Follow (kernel.js
// setFollows, nothing else writes a follow) and its bills, testimony open first, then still moving, then became law, then the
// rest, four shown and "Show N more" in place; "Other bills" (HIPHI's bills on no issue); and the foot: Every bill HIPHI tracks,
// Committees, For advocacy groups. Lists from HIPHI (as rec/find.js listRows draws them) come after Needs voices (see listRows).
// What the screen remembers (B-6): the topic, the search, the issues opened and where it was scrolled to, for the visit in
// sessionStorage under its own key (the practice copy's under _demo). A search also lives in the address, as Find's does.
// The screen has no filled button on purpose (A-3 allows a screen with none): it is for browsing, and the row a person opens
// has the one action. The issue, category and list routes keep their own modules (pub/app.js).
import { S, app, esc, icon, nick, spaced, billPath, sessionInfo, issuesOf, issueFollowed, issueBills, plainStatus, stopOf, alive,
  dismissed, recommendations, issueIcon, anyBill, findBill, loadRecapPool, followYear, setFollows, dayWord, timeWord, timed, supa, DEMO } from '../core.js';
import { skeleton, loadFail } from '../ui.js';
import F0, { parse, startSearch, searchNote, capNote, issueMatches, findHooks, wireSearch, shows, offSeason } from '../find.js';
import { stopped, becameLaw, numCmp, what } from '../mybills.js';
import { recSec, recRow, recEmpty, BOX, keep } from '../rec/kit.js';

const F = S.fd;   // find.js's search state (the query, its results, its cache)
const DAY = 864e5, SHOW = 4, VOICES = 5, OTHER_SEARCH = 10;

// ---------------- what the screen remembers (B-6) ----------------
const KEEP = DEMO ? 'hiphi_v3_find_demo' : 'hiphi_v3_find';
const M = (() => {
  try { const x = JSON.parse(sessionStorage.getItem(KEEP) || 'null');
    if (x) return { q: String(x.q || ''), topic: String(x.topic || ''), open: new Set(Array.isArray(x.open) ? x.open : []), y: +x.y || 0, back: !!x.back }; }
  catch { /* storage blocked: the screen starts afresh */ }
  return { q: '', topic: '', open: new Set(), y: 0, back: false };
})();
const save = () => { try { sessionStorage.setItem(KEEP, JSON.stringify({ ...M, open: [...M.open] })); } catch { /* kept for this page only */ } };
// Where it is scrolled to, kept as the person scrolls (only while this screen is drawn).
let scrollT = 0;
addEventListener('scroll', () => {
  if (!document.querySelector('.v3b')) return;
  clearTimeout(scrollT);
  scrollT = setTimeout(() => { if (document.querySelector('.v3b') && !M.back) { M.y = Math.round(scrollY); save(); } }, 150);
}, { passive: true });

// ---------------- the bills ----------------
// Every bill HIPHI has a position on this year (core.js loadRecapPool: the moving ones and the rest), and any bill on an issue that
// is not among them (a bill HIPHI only watches can sit on an issue), asked for once a visit.
const L = S.v3find ??= { state: '', bills: [] };
async function load() {
  const yr = followYear(), pool = await loadRecapPool(yr);
  const need = [...new Set(S.issues.flatMap(issueBills))].filter(id => !findBill(id) && !pool.some(b => b.id === id));
  if (need.length && !DEMO) {
    const sb = await supa();
    for (let i = 0; i < need.length; i += 100) {
      const { data, error } = await sb.from('public_all_bills').select('*').in('id', need.slice(i, i + 100)); if (error) throw error;
      (data || []).forEach(b => { S.extra[b.id] ??= b; });
    }
  }
  return pool;
}
function ensure() {
  if (L.state) return;
  L.state = 'loading';
  timed(load()).then(bs => { L.bills = bs; L.state = 'ready'; }).catch(e => { console.error(e); L.state = 'err'; })
    .finally(() => { if (document.body.dataset.screen === 'find' && !F.cur) paint(); });
}
const billOf = id => anyBill(id) || L.bills.find(b => b.id === id) || null;
const billsOn = i => issueBills(i).map(billOf).filter(Boolean);

// ---------------- one line for where a bill stands (Find's words, rec/find.js billLine) ----------------
const dayShort = iso => { const d = dayWord(iso); return /^today/.test(d) ? 'today' : /^tomorrow/.test(d) ? 'tomorrow' : d; };
const when = iso => keep(`${dayShort(iso)} ${timeWord(iso)}`);
// Testimony still open on a hearing ahead, else null.
function dueOf(b) {
  if (!alive(b)) return null;
  const st = stopOf(b), h = st.hearingState === 'scheduled' && st.hearing && Date.parse(st.hearing.scheduled_at) > Date.now() ? st.hearing : null;
  return h ? { h, at: h.testimony_deadline && Date.parse(h.testimony_deadline) > Date.now() ? h.testimony_deadline : '' } : null;
}
// "HB 1563 · Testimony due Mon 9:30 AM" (amber inside a day, A-5), "HB 1563 · Hearing Thu 2:00 PM", "HB 1563 · Waiting for a
// hearing", "HB 1563 · Became law", "HB 1563 · Did not advance" (C-15's words, never "dead").
function lineOf(b) {
  const num = spaced(b.bill_number), d = dueOf(b);
  if (d?.at) return { text: `${num} · Testimony due ${when(d.at)}`, warn: Date.parse(d.at) - Date.now() < DAY };
  if (d) return { text: `${num} · Hearing ${when(d.h.scheduled_at)}` };
  let s = ''; try { s = plainStatus(b).short; } catch { /* a bill without its record: the number alone */ }
  return { text: s ? `${num} · ${s.replace(/ · \d+ days? left$/, '')}` : num };
}
const nameOf = b => nick(b) || what(b, 90);
// Testimony open first, soonest first; then bills still moving; then the ones that became law; then the rest.
const rank = b => dueOf(b)?.at ? 0 : !stopped(b) && !becameLaw(b) && alive(b) ? 1 : becameLaw(b) ? 2 : 3;
const order = bs => bs.slice().sort((x, y) => rank(x) - rank(y) || (rank(x) === 0 ? dueOf(x).at.localeCompare(dueOf(y).at) : 0) || numCmp(x, y));
const row = b => { const l = lineOf(b);
  return `<li><a class="rc-row" href="${esc(billPath(b))}" data-v3bill><span class="rc-rtext"><span class="rc-rname">${esc(nameOf(b))}</span><span class="rc-rstat${l.warn ? ' warn' : ''}">${esc(l.text)}</span></span>${icon('chevron-right', { cls: 'rc-chev' })}</a></li>`; };
// A list that shows its first n and opens the rest in place, remembered (M.open) so Back and a reload find it open (B-6).
function rowsOf(bills, key, n = SHOW) {
  const open = M.open.has(key) || bills.length <= n + 1, shown = open ? bills : bills.slice(0, n);
  return `<ul class="rc-rows ${BOX}" role="list" id="v3b-rows-${esc(key)}">${shown.map(row).join('')}</ul>`
    + (open ? '' : `<button type="button" class="btn text v3b-more" data-v3more="${esc(key)}" aria-controls="v3b-rows-${esc(key)}" aria-expanded="false">${icon('chevron-down')}<span>Show ${bills.length - n} more</span></button>`);
}

// ---------------- the lists, for the topic and the search chosen ----------------
const inTopic = i => !M.topic || (i.categories || [i.category]).includes(M.topic);
const catOrder = () => new Map((S.cats || []).map((c, k) => [c.key, k]));
const byIssueOrder = co => (x, y) => (co.get(x.category) ?? 99) - (co.get(y.category) ?? 99) || (x.sort_order ?? 99) - (y.sort_order ?? 99) || x.name.localeCompare(y.name);
function sections(q) {
  const co = catOrder(), issues = S.issues.filter(inTopic).sort(byIssueOrder(co));
  if (!q) {
    const on = new Set(S.issues.flatMap(issueBills));
    return { issues: issues.map(i => ({ i, bills: order(billsOn(i)) })).filter(s => s.bills.length),
      other: M.topic ? [] : order(L.bills.filter(b => !on.has(b.id) && !issuesOf(b).length)) };
  }
  // A search: an issue whose own words match shows all its bills; otherwise an issue shows the bills the search found that say
  // the words where a person sees them (find.js shows: the name or HIPHI's summary), or every bill for a number. Everything else
  // the search found is "Other bills", so nothing it found is left out (B-3).
  const P = parse(q), res = (F.res || []).filter(b => !/^GM/i.test(b.bill_number) || P.num), named = new Set(P.num ? [] : issueMatches(q).map(i => i.id));
  const placed = new Set(), out = [];
  for (const i of issues) {
    const ids = new Set(issueBills(i));
    const bills = named.has(i.id) ? billsOn(i) : res.filter(b => ids.has(b.id) && (P.num || shows(b, P)));
    if (!bills.length) continue;
    bills.forEach(b => placed.add(b.id)); out.push({ i, bills: order(bills) });
  }
  return { issues: out, other: M.topic ? [] : order(res.filter(b => !placed.has(b.id))) };
}
// Needs voices this week: the ranking behind today's Find (rank.js), each bill once, with a hearing inside the next seven days and
// testimony still open, in the topic chosen, none put aside ("Not for me"); soonest first. None while searching: the matches
// are the list.
function voices() {
  if (offSeason()) return [];
  const skip = dismissed(), now = Date.now(), seen = new Set(), out = [];
  for (const r of recommendations(200)) {
    const b = r.b, h = r.hearing || r.st?.hearing; if (!h || seen.has(b.id) || skip.has(b.id)) continue;
    const t = Date.parse(h.scheduled_at); if (!(t > now && t < now + 7 * DAY)) continue;
    if (h.testimony_deadline && Date.parse(h.testimony_deadline) <= now) continue;
    if (M.topic && !issuesOf(b).some(inTopic)) continue;
    seen.add(b.id); out.push({ b, at: Date.parse(h.testimony_deadline || h.scheduled_at) });
  }
  return out.sort((x, y) => x.at - y.at).slice(0, VOICES).map(x => x.b);
}

// ---------------- the pieces ----------------
// The quiet Follow beside an issue's name: one outlined pill, or once followed the pale "Following" (as rec/kit.js recFollow draws it).
const follow = (i, on) => on
  ? `<button type="button" class="rc-fpill on v3b-follow" data-v3follow="${esc(i.id)}" aria-pressed="true" aria-label="Following ${esc(i.name)}. Press to stop following.">${icon('check')}<span>Following</span></button>`
  : `<button type="button" class="rc-fpill v3b-follow" data-v3follow="${esc(i.id)}" aria-pressed="false" aria-label="Follow ${esc(i.name)}">${icon('star')}<span>Follow</span></button>`;
function issueSec({ i, bills }) {
  const cat = !M.topic ? (S.cats || []).find(c => c.key === i.category)?.name : '';
  return `<section class="v3b-isec" id="v3b-i-${esc(i.slug)}" aria-labelledby="v3b-ih-${esc(i.slug)}">
    <div class="v3b-ihead"><span class="v3b-ilead" aria-hidden="true">${icon(issueIcon(i.icon))}</span><span class="v3b-iname"><h3 id="v3b-ih-${esc(i.slug)}"><a href="#/issue/${esc(i.slug)}">${esc(i.name)}</a></h3>${cat ? `<span class="v3b-cat">${esc(cat)}</span>` : ''}</span>${follow(i, issueFollowed(i))}</div>
    ${rowsOf(bills, i.id)}</section>`;
}
// Lists from HIPHI (rec/find.js listRows): quiet rows in a white box, each to the list's page, whose one button follows it. Above
// the issues, not at the foot the plan named: with every issue's bills under it the foot is about 25,000px down a phone, where
// HIPHI's lists would be lost. Hidden while a topic is chosen (a list spans topics).
const listRows = () => { const ls = S.lists || []; if (!ls.length) return '';
  return recSec('v3b-lists-h', 'Lists from HIPHI', `<ul class="rc-rows rc-lists ${BOX}" role="list">${ls.map(l => recRow({ name: l.title,
    text: S.listFollows?.has(l.id) ? 'You follow this list' : l.description || '', href: `#/list/${encodeURIComponent(l.slug)}`, lead: issueIcon(l.icon, 'list') })).join('')}</ul>`,
    { note: offSeason() ? 'Follow a list now and its bills come to you as HIPHI adds them.' : 'Follow a list to follow its bills, plus any HIPHI adds later.' }); };
const foot = () => `<nav class="rc-foot v3b-foot" aria-label="More to look up"><ul class="rc-rows ${BOX}" role="list">
  ${recRow({ name: 'Every bill HIPHI tracks', text: 'A table you can sort and search', href: '#/allbills', lead: 'list' })}${recRow({ name: 'Committees', href: '#/committees', lead: 'landmark' })}${recRow({ name: 'For advocacy groups', text: 'Share HIPHI’s asks with your members', href: '#/groups', lead: 'users' })}</ul></nav>`;
const chips = () => [{ key: '', name: 'All topics' }, ...(S.cats || [])].map(c => `<button type="button" class="v3b-chip" data-v3topic="${esc(c.key)}" aria-pressed="${M.topic === c.key}">${esc(c.name)}</button>`).join('');

const openWords = si => si.nextOpen ? new Date(si.nextOpen + 'T12:00:00-10:00').toLocaleDateString('en-US', { timeZone: 'Pacific/Honolulu', weekday: 'long', month: 'long', day: 'numeric' }) : 'in January';
function browse() {
  if (L.state === 'err') return loadFail({ inline: true, what: 'HIPHI’s bills', id: 'v3b-err', retry: { 'data-v3retry': '1' } });
  if (L.state !== 'ready') return skeleton(4);
  const si = sessionInfo(), S1 = sections(''), vs = voices();
  return `${si.phase !== 'in' ? `<p class="rc-note rc-off">The Legislature is on break until ${esc(openWords(si))}. Here is where each ${si.recapYear} bill ended up.</p>` : ''}
    ${vs.length ? recSec('v3b-voices-h', 'Needs voices this week', `<ul class="rc-rows ${BOX}" role="list">${vs.map(row).join('')}</ul>`) : ''}
    ${M.topic ? '' : listRows()}
    ${S1.issues.length || S1.other.length ? `<section class="rc-sec v3b-issues" aria-labelledby="v3b-iss-h"><h2 class="rc-h2" id="v3b-iss-h">Bills by issue</h2>${S1.issues.map(issueSec).join('')}</section>` : recEmpty('No bills on this topic yet.')}
    ${S1.other.length ? recSec('v3b-other-h', 'Other bills', rowsOf(S1.other, 'other')) : ''}
    ${foot()}`;
}
const everyLink = () => `<p class="rc-every"><a class="btn text" href="#/allbills"><span>See every bill HIPHI tracks</span>${icon('chevron-right')}</a></p>`;
function found(q) {
  const P = parse(q), ready = F.key === P.key && !F.busy;
  if (ready && F.err) return loadFail({ inline: true, what: 'the results', id: 'fd-err', cls: 'fd-err', retry: { 'data-v3research': '1' } });
  if (!ready || !F.res) return skeleton(3);
  const S1 = sections(q);
  if (!S1.issues.length && !S1.other.length) return `${recEmpty(M.topic ? `Nothing in this topic matches “${q}”. Try All topics.` : `Nothing matches “${q}”. Try one word, like e-cigarettes, or a bill number like HB 1563.`)}${everyLink()}`;
  return `${searchNote(F.res, P)}
    ${S1.issues.length ? `<section class="rc-sec v3b-issues" aria-labelledby="v3b-iss-h"><h2 class="rc-h2" id="v3b-iss-h">Bills by issue</h2>${S1.issues.map(issueSec).join('')}</section>` : ''}
    ${S1.other.length ? recSec('v3b-other-h', S1.issues.length ? 'Other bills' : 'Bills', rowsOf(S1.other, 'q-other', OTHER_SEARCH)) : ''}
    ${capNote(F.res)}${everyLink()}`;
}
const said = () => !F.cur ? '' : F.busy ? 'Searching' : F.err ? 'Search did not work' : F.res ? `Results for “${F.cur}”` : '';

// ---------------- the page ----------------
function page(q) {
  q = (q || '').trim();
  F.cur = q; M.q = q; save();
  if (q) startSearch(q); else ensure();
  return `<div class="fd rc v3b" data-page="find">
    <form class="fd-search" role="search" action="#" novalidate>
      <h1 class="fd-h1 hero"><label for="q">Find issues and bills</label></h1>
      <div class="searchbox fd-box${q && F.busy ? ' busy' : ''}">${icon('search')}<span class="fd-spin" aria-hidden="true">${icon('loader-circle')}</span>
        <input id="q" class="input" type="search" enterkeyhint="search" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false"
          placeholder="${matchMedia('(max-width: 359px)').matches ? 'e-cigarettes or HB 1563' : 'Try e-cigarettes, HB 1563 or a name'}" value="${esc(q)}">
        <button type="button" class="iconbtn clear fd-clear" aria-label="Clear search"${q ? '' : ' hidden'}>${icon('x')}</button></div>
    </form>
    <div class="v3b-chips" role="group" aria-label="Topics">${chips()}</div>
    <p class="sr" role="status" id="fd-status"></p>
    <div id="v3b-res">${q ? found(q) : browse()}</div>
  </div>`;
}
// Typing and the chips redraw only the results (find.js runQuery calls this through findHooks), so the box keeps its keyboard.
// The header's search may load rec/find.js, which puts its own painter in findHooks; that one finds no #fd-results here and asks
// for a whole redraw, whose wire() puts this one back.
function paint() {
  if (document.body.dataset.screen !== 'find') return;
  const box = document.getElementById('v3b-res'); if (!box) { app.render(); return; }
  if (M.q !== F.cur) { M.q = F.cur; save(); }
  if (!F.cur) ensure();
  box.innerHTML = F.cur ? found(F.cur) : browse();
  wireRes(box, true);
  document.querySelector('.fd-box')?.classList.toggle('busy', !!(F.cur && F.busy) || F.pending);
  const st = document.getElementById('fd-status'); if (st) st.textContent = said();
  restore();
}
findHooks.paint = paint;

// Follow and stop following an issue, through the kernel's one way (setFollows). An issue followed through its whole topic stops
// the topic and keeps the topic's other issues followed (as core.js unfollowIssue does).
async function toggleFollow(i) {
  if (!issueFollowed(i)) return setFollows({ issuesOn: [i.id] });
  const cats = (i.categories || [i.category]).filter(c => S.catFollows.has(c));
  const keepOn = cats.length ? S.issues.filter(x => x.id !== i.id && (x.categories || [x.category]).some(c => cats.includes(c))).map(x => x.id) : [];
  return setFollows({ issuesOff: [i.id], catsOff: cats, issuesOn: keepOn });
}
function wireRes(box, links) {
  if (!box) return;
  box.querySelectorAll('[data-v3follow]').forEach(el => el.onclick = async () => {
    const i = S.issueById.get(el.dataset.v3follow); if (!i || el.getAttribute('aria-busy') === 'true') return;
    el.setAttribute('aria-busy', 'true');
    try { await toggleFollow(i); } catch (e) { console.error(e); }
    paint(); document.querySelector(`#v3b-res [data-v3follow="${CSS.escape(i.id)}"]`)?.focus({ preventScroll: true });
  });
  box.querySelectorAll('[data-v3more]').forEach(el => el.onclick = () => {
    const k = el.dataset.v3more, n = document.querySelectorAll(`#v3b-rows-${CSS.escape(k)} > li`).length;
    M.open.add(k); save(); paint();
    document.querySelector(`#v3b-rows-${CSS.escape(k)} > li:nth-child(${n + 1}) a`)?.focus({ preventScroll: true });   // the first bill just shown
  });
  box.querySelectorAll('[data-v3retry]').forEach(el => el.onclick = () => { L.state = ''; paint(); });
  box.querySelectorAll('[data-v3research]').forEach(el => el.onclick = () => { F.cache.delete(F.key); F.key = null; if (F.cur) startSearch(F.cur); paint(); });
  // Leaving for a bill: Back (or a reload) finds the list where it was.
  box.addEventListener('click', e => { if (e.target.closest('a[href^="#/"]')) { M.y = Math.round(scrollY); M.back = true; save(); } });
  // Rows painted in place were not there when app.js wired the page's links: keep them in the app.
  if (links) box.querySelectorAll('a[href^="#/"]').forEach(a => a.addEventListener('click', e => { if (e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); app.go(a.getAttribute('href')); }));
}
// Back from a bill: once the lists are drawn (the first draw, or the paint after the bills come), the place it was left; the
// app's own restore runs before the bills have come.
function restore() {
  if (!M.back || !document.querySelector('#v3b-res .rc-row')) return;
  const y = M.y; M.back = false; save();
  requestAnimationFrame(() => window.scrollTo(0, y));
}

export default {
  tab: 'find',
  title: r => F0.title(r),
  render(r) {
    // A search kept from before (B-6) comes back when Find is opened without one, and goes into the address as a typed one does.
    if (!r.q && M.q && M.back) { r = { ...r, q: M.q }; try { history.replaceState(history.state, '', `#/find?q=${encodeURIComponent(M.q)}`); } catch { /* ignore */ } }
    return page(r.q);
  },
  wire() {
    findHooks.paint = paint;
    const root = document.querySelector('.v3b'); if (!root) return;
    wireSearch(); wireRes(document.getElementById('v3b-res'), false);
    root.querySelector('.v3b-chips').addEventListener('click', e => {
      const c = e.target.closest('[data-v3topic]'); if (!c) return;
      M.topic = c.dataset.v3topic; M.open.clear(); save();
      root.querySelectorAll('[data-v3topic]').forEach(x => x.setAttribute('aria-pressed', String(x === c)));
      paint();
    });
    const st = document.getElementById('fd-status'); if (st) st.textContent = said();
    restore();
  },
};