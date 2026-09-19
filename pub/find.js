// Find (tab): one search box, HIPHI's lists, the issues, and bills that need voices this week. The same module draws
// an issue's page (#/find/issue/<slug>) and a HIPHI list's page (#/list/<slug>, also the old #list= links).
//
// Search covers HIPHI's plain summary as well as the official title and description, and knows the words people
// actually type: "vaping" finds the e-cigarette bills even when the summary says "flavored vapes", "keiki" finds
// bills about children, "lunch" finds school meals, "soda" finds sugary drinks (walkthrough 9/18: "vaping" found one
// dead bill and missed the three live ones). It also covers the bill's nickname ("Disposable vape ban"), which is
// what people will have seen everywhere else (9/19). Bills still moving come first; stopped ones wait in a fold.
//
// On a wide screen (1100px and up) the page stops being a phone column: the issues are a grid of tiles, HIPHI's
// lists are cards side by side, bills are table rows (mybills.js), a list's Follow button sits beside its title, and
// the suggestion card shares its row with the other bills that have a hearing this week.
import { S, D, DEMO, app, esc, icon, nick, posInfo, countOk, issues, issueIcon, groupNames, wiz, sessionInfo, recommendations, dismissed,
  browseCoalition, curate, listBillsFor, followList, toggleWatch, loadBills, saveLocal, saveListFollows, nudge, toast, supa, plain, POS_RANK } from './core.js';
import { btn, row, skeleton, notice, inlineErr } from './ui.js';
import { actionCard, wireActions } from './actions.js';
import { billList, fold, wireRows, emptyBox, moving, becameLaw, stopped, numCmp, byUrgency, listCards, listPromise, nextYear } from './mybills.js';

// Find's own state, kept across renders: the query being searched, its results, a small cache, and which lists
// and issues have loaded.
const F = S.fd ??= { cur: '', key: null, res: null, busy: false, pending: false, err: false, seq: 0, shown: null, cache: new Map(),
  issues: {}, lists: {}, more: {}, recs: null, t: 0 };
const HST = 'Pacific/Honolulu';
const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;
const offSeason = () => sessionInfo().phase !== 'in';
const openWords = si => si.nextOpen ? new Date(si.nextOpen + 'T12:00:00-10:00').toLocaleDateString('en-US', { timeZone: HST, weekday: 'long', month: 'long', day: 'numeric' }) : 'in January';

// ---------------- search ----------------
// Synonym groups: typing any word in a group also searches the others. Phrases ("sugary drink") are matched whole.
// The official descriptions say "electronic smoking device" where people say "vape", so that phrase is in too.
const SYN = [
  ['vape', 'vaping', 'vapor', 'e-cig', 'ecig', 'electronic smoking', 'electronic cigarette', 'flavored'],
  ['keiki', 'kids', 'children', 'child', 'youth'],
  ['lunch', 'meal'],
  ['soda', 'sugary drink', 'sugary beverage', 'sugar-sweetened', 'sweetened beverage'],
];
const STOP = new Set(['the', 'a', 'an', 'and', 'or', 'of', 'for', 'to', 'in', 'on', 'about', 'with', 'bill', 'bills', 'act']);
const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function termsFor(w) {
  const g = SYN.find(g => g.some(t => w === t || w.startsWith(t) || (w.length >= 4 && t.startsWith(w))));
  return [...new Set([w, ...(g || [])])];
}
// "hb 1563", "HB1563" and "1563" are bill numbers; anything else is words.
function parse(q) {
  const raw = plain(q).replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim();
  const m = /^([a-z]{1,3})?\s*-?\s*0*(\d{1,4})$/.exec(raw);
  if (m) return { key: 'n:' + (m[1] || '') + m[2], num: { pre: (m[1] || '').toUpperCase(), n: m[2] } };
  let rest = ` ${raw} `; const words = [];
  for (const g of SYN) for (const t of g) if (t.includes(' ') && rest.includes(` ${t}`)) { words.push(t); rest = rest.replace(` ${t}`, ' '); }
  words.push(...rest.split(' ').filter(w => w && !STOP.has(w) && (w.length > 1 || /\d/.test(w))));
  const uniq = [...new Set(words)];
  return { key: 'w:' + uniq.join(' '), words: uniq.map(w => ({ w, re: new RegExp(`(?:^|[^a-z0-9])(?:${termsFor(w).map(reEsc).join('|')})`), terms: termsFor(w) })) };
}
// Where a word is found decides how high the bill ranks: the nickname first (it is the name people have seen), then
// HIPHI's summary and ask, the official title last.
const FIELDS = [['hiphi_nickname', 8], ['hiphi_summary', 6], ['hiphi_action', 4], ['description', 3], ['title', 2]];
const hay = new WeakMap();
const fieldsOf = b => { let f = hay.get(b); if (!f) { f = FIELDS.map(([k, w]) => [plain(k === 'hiphi_nickname' ? nick(b) : b[k] || ''), w]); hay.set(b, f); } return f; };
function score(b, P) {
  if (P.num) {
    const m = /^([A-Z]+)\s*(\d+)/.exec(String(b.bill_number).toUpperCase()); if (!m) return null;
    if (P.num.pre && !m[1].startsWith(P.num.pre)) return null;
    if (m[2] === P.num.n) return { hits: 1, pts: 100 };
    return m[2].startsWith(P.num.n) ? { hits: 1, pts: 40 } : null;
  }
  let hits = 0, pts = 0;
  for (const w of P.words) { const best = Math.max(0, ...fieldsOf(b).filter(([t]) => w.re.test(t)).map(([, wt]) => wt)); if (best) { hits++; pts += best; } }
  if (!hits) return null;
  return { hits, pts: pts + (posInfo(b) ? 20 : b.hiphi_follows ? 5 : 0) + (b.hiphi_summary ? 3 : 0) };
}
// Every word must match; if nothing does, fall back to bills that match the most words.
function rank(cands, P) {
  if (P.words && !P.words.length) return [];
  const seen = new Set(), all = [];
  for (const b of cands) { if (seen.has(b.id)) continue; seen.add(b.id); const s = score(b, P); if (s) all.push({ b, ...s }); }
  const need = P.num ? 1 : P.words.length;
  let out = all.filter(x => x.hits >= need);
  if (!out.length && need > 1) { const top = Math.max(0, ...all.map(x => x.hits)); out = all.filter(x => x.hits === top); }
  return out.sort((x, y) => y.pts - x.pts || numCmp(x.b, y.b)).slice(0, 80).map(x => x.b);
}
// The live page asks the database for candidates (every word, with its synonyms, in any of the text columns), then
// ranks them here with the same rules as the sandbox. HIPHI's bills are fetched separately so a common word
// ("school") cannot push them past the row limit. The nickname column arrived with migration 056; if a database
// does not have it, the search quietly carries on without it rather than failing.
let NICK_COL = true;
async function serverSearch(P, any = false) {
  const sb = await supa(), cols = [...(NICK_COL ? ['hiphi_nickname'] : []), 'hiphi_summary', 'description', 'title'];
  const clean = t => t.replace(/[^a-z0-9 -]/g, '').trim();
  const inner = w => w.terms.map(clean).filter(Boolean).flatMap(t => cols.map(c => `${c}.ilike."*${t}*"`)).join(',');
  const filter = P.num ? `bill_number.ilike.${P.num.pre}*${P.num.n}*` : any ? P.words.map(inner).join(',') : `and(${P.words.map(w => `or(${inner(w)})`).join(',')})`;
  const q = () => sb.from('public_all_bills').select('*').or(filter);
  const [a, b] = await Promise.all([q().not('hiphi_position', 'is', null).limit(150), q().order('bill_number').limit(80)]);
  const bad = a.error || b.error;
  if (bad && NICK_COL && !P.num && /hiphi_nickname/.test(bad.message || '')) { NICK_COL = false; return serverSearch(P, any); }
  if (bad) throw bad;
  return [...(a.data || []), ...(b.data || [])];
}
// Bills nobody here follows arrive without their hearings, and a status chip without the hearing would say
// "waiting" when a hearing is set. Load hearings for the moving ones (the same cache the bill page uses, S.xh).
async function ensureHearings(bills) {
  const need = [...new Set(bills.filter(b => moving(b) && !S.bills.some(x => x.id === b.id) && !S.xh[b.id]).map(b => b.id))];
  if (!need.length) return;
  if (DEMO) { for (const id of need) { S.xh[id] = D.hearings.filter(h => h.bill_id === id); D.outcomes.filter(o => o.bill_id === id).forEach(o => { S.outcomes[o.hearing_id] = o; }); } return; }
  const sb = await supa();
  for (let i = 0; i < need.length; i += 60) {
    const ids = need.slice(i, i + 60);
    const [h, o] = await Promise.all([sb.from('public_all_hearings').select('*').in('bill_id', ids), sb.from('public_hearing_outcomes').select('*').in('bill_id', ids)]);
    if (h.error) throw h.error;
    ids.forEach(id => { S.xh[id] = []; });
    (h.data || []).forEach(x => S.xh[x.bill_id]?.push(x));
    (o.data || []).forEach(x => { S.outcomes[x.hearing_id] = x; });
  }
}
function startSearch(q) {
  const P = parse(q);
  if (F.key === P.key && (F.res || F.busy)) return;
  F.key = P.key; F.err = false;
  if (F.cache.has(P.key)) { F.res = F.cache.get(P.key); F.busy = false; return; }
  F.res = null; F.busy = true; const my = ++F.seq;
  (async () => {
    let res;
    if (DEMO) res = rank([...D.bills, ...D.index], P);
    else { res = rank(await serverSearch(P), P); if (!res.length && P.words?.length > 1) res = rank(await serverSearch(P, true), P); }
    await ensureHearings(res.slice(0, 40));
    return res;
  })().then(res => { if (my !== F.seq) return; F.cache.set(P.key, res); if (F.cache.size > 20) F.cache.delete(F.cache.keys().next().value); F.res = res; })
    .catch(e => { if (my !== F.seq) return; console.error(e); F.err = true; })
    .finally(() => { if (my !== F.seq) return; F.busy = false; paint(); });
}
// Typing updates the results in place and keeps the query in the address (so Back and reload return to it). It does
// not call app.go on every keystroke: a full redraw replaces the text box, and on a phone that closes the keyboard
// mid-word.
function runQuery(v) {
  const q = v.trim();
  F.cur = q;
  const hq = document.getElementById('hq'); if (hq && hq !== document.activeElement) hq.value = q;   // the header's box on wide screens
  try { history.replaceState(history.state, '', q ? `#/find?q=${encodeURIComponent(q)}` : '#/find'); } catch { /* ignore */ }
  document.title = (q ? `“${q}” · ` : 'Find bills · ') + 'HIPHI Bill Tracker';
  if (q) startSearch(q); else { F.seq++; F.busy = false; F.key = null; }
  paint();
}
// Redraw only the results (the search box and its keyboard stay put).
function paint() {
  if (document.body.dataset.screen !== 'find') return;
  const box = document.getElementById('fd-results'); if (!box) { app.render(); return; }
  box.innerHTML = F.cur ? resultsHTML(F.cur) : browseHTML();
  wireRegion(box, true);
  setBusy();
  const st = document.getElementById('fd-status');
  if (st) st.textContent = !F.cur ? '' : F.busy ? 'Searching' : F.err ? 'Search did not work' : F.res ? (F.res.length ? `${plural(F.res.length, 'bill')} found` : 'No bills found') : '';
}
const setBusy = () => document.querySelector('.fd-box')?.classList.toggle('busy', !!(F.cur && F.busy) || F.pending);

// ---------------- pieces ----------------
const slugify = s => plain(s).replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const canon = s => slugify(s).split('-').filter(w => w && w !== 'and').join('-');
export const issueSlug = g => slugify(g.key);
// An issue's address is its public name slugified ("tobacco-free-hawaii") or one of its coalitions' own slugs ("ctfh").
function issueBySlug(slug) {
  const want = canon(slug || ''); if (!want) return null;
  return issues().find(g => [g.key, ...g.names, ...g.names.map(n => (S.coalitions || []).find(c => c.name === n)?.slug)].filter(Boolean).some(x => canon(x) === want)) || null;
}
const listBySlug = slug => (S.lists || []).find(l => l.slug === slug) || null;
const back = (href, label) => `<a class="fd-back" href="${href}">${icon('arrow-left')}<span>${label}</span></a>`;

// One issue: a row on a phone, a tile in a grid on a wide screen (.mb-tiles). The count is a number over a word
// (bills, not people, so it is always shown) and keeps to a narrow column so the issue's name gets the width.
function issueRow(g) {
  const off = offSeason();
  const end = off ? `<span class="fd-count"><b>${g.bills}</b><span>${g.bills === 1 ? 'bill' : 'bills'}</span></span>`
    : g.live ? `<span class="fd-count"><b>${g.live}</b><span>moving</span></span>` : '<span class="fd-count quiet"><span>Quiet</span><span>now</span></span>';
  return row({ leadHtml: `<span class="lead">${icon(g.icon)}</span>`, title: esc(g.key), sub: g.description ? `<span class="mb-clamp">${esc(g.description)}</span>` : '', end, href: `#/find/issue/${issueSlug(g)}` });
}
// Between sessions nothing is moving, so the issues HIPHI worked on most come first (the catch-all still last).
const issueOrder = () => offSeason() ? issues().slice().sort((a, b) => a.general - b.general || b.bills - a.bills) : issues();
const issueTiles = () => `<div class="rows fd-rows mb-tiles grid3">${issueOrder().map(issueRow).join('')}</div>`;
const sechead = (id, title, meta = '') => `<div class="sechead"><h2 id="${id}">${title}</h2>${meta ? `<span class="meta">${meta}</span>` : ''}</div>`;
// Long groups show 10, then "Show all".
function capped(key, bills, opt, n = 10) {
  const all = !!F.more[key], shown = all ? bills : bills.slice(0, n);
  return `<div data-grp="${esc(key)}">${billList(shown, opt)}</div>${!all && bills.length > n ? `<div class="fd-more">${btn(`Show all ${bills.length}`, { kind: 'text', iconEnd: 'chevron-down', attrs: { 'data-fdmore': key, 'data-from': n } })}</div>` : ''}`;
}
// One reason per suggested bill, in the person's terms (never "you follow X", which reads wrong after the start).
function reason(b) {
  const picked = new Set((wiz().issues || []).flatMap(groupNames)), mine = new Set(S.bills.flatMap(x => x.coalitions || []));
  if ((b.coalitions || []).some(n => picked.has(n))) return 'Matches an issue you picked';
  if ((b.coalitions || []).some(n => mine.has(n))) return 'Like bills you follow';
  if (/strongly/.test(b.hiphi_position || '')) return 'One of HIPHI’s top priorities';
  return 'Testimony is open this week';
}
// Bills to suggest: a hearing this week on a bill the person does not follow. The picks are made once per visit to
// this page and kept while the person is on it, so following one (from its card or its star) leaves it in place,
// now marked as followed, instead of making it vanish from under the pointer. "Not for me" does remove it, and the
// next suggestion moves up.
function suggestions() {
  const skip = dismissed(), ok = r => r.kind === 'testify' && r.st.hearing && !skip.has(r.b.id);
  const list = (F.recs || []).filter(ok), have = new Set(list.map(r => r.b.id));
  for (const r of recommendations(20)) { if (list.length >= 4) break; if (ok(r) && !have.has(r.b.id)) list.push(r); }
  return F.recs = list;
}

// ---------------- the Find page ----------------
function findPage(q) {
  q = (q || '').trim();
  if (q !== F.cur) { F.cur = q; }
  if (q) startSearch(q);
  if (!document.querySelector('.fd[data-page="find"]')) F.recs = null;   // arriving afresh: choose the suggestions again
  const busy = !!(q && F.busy);
  return `<div class="fd" data-page="find">
    <form class="fd-search" role="search" action="#" novalidate>
      <h1 class="fd-h1 hero"><label for="q">Find bills</label></h1>
      <div class="searchbox fd-box${busy ? ' busy' : ''}">${icon('search')}<span class="fd-spin" aria-hidden="true">${icon('loader-circle')}</span>
        <input id="q" class="input" type="search" enterkeyhint="search" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false"
          placeholder="Try vaping, school meals or HB 1563" value="${esc(q)}">
        <button type="button" class="iconbtn clear fd-clear" aria-label="Clear search"${q ? '' : ' hidden'}>${icon('x')}</button></div>
    </form>
    <p class="sr" role="status" id="fd-status"></p>
    <div id="fd-results">${q ? resultsHTML(q) : browseHTML()}</div>
  </div>`;
}
function resultsHTML(q) {
  const P = parse(q), ready = F.key === P.key && !F.busy;
  if (ready && F.err) return `<div class="fd-err">${inlineErr('fd-err', 'Search didn’t work just now. Check your connection and try again.')}${btn('Try again', { kind: 'secondary', icon: 'rotate-ccw', attrs: { 'data-retry': '1' } })}</div>`;
  if (!ready || !F.res) return F.shown ? `<div class="fd-stale" inert>${resultsBody(F.shown.q, F.shown.res)}</div>` : skeleton(3);
  F.shown = { q, res: F.res };
  return resultsBody(q, F.res);
}
function resultsBody(q, res) {
  if (!res.length) return `${emptyBox({ title: `No bills match “${esc(q)}”`, text: 'Try a bill number like HB 1563, or a word like vaping.' })}
    <section aria-labelledby="fd-or-h">${sechead('fd-or-h', 'Or browse by issue')}${issueTiles()}</section>`;
  const key = parse(q).key, mv = res.filter(moving), law = res.filter(becameLaw), gone = res.filter(stopped);
  return `${mv.length ? `<section aria-labelledby="fd-mv-h">${sechead('fd-mv-h', 'Moving now', plural(mv.length, 'bill'))}${capped('q:' + key, mv, { pos: true }, 12)}</section>`
      : `<p class="fd-none">${offSeason() ? `The ${sessionInfo().recapYear} session is over. Here’s where these bills ended up.` : `Nothing that matches “${esc(q)}” is moving right now.`}</p>`}
    ${law.length ? `<section aria-labelledby="fd-law-h">${sechead('fd-law-h', 'Became law', plural(law.length, 'bill'))}${billList(law, { pos: true })}</section>` : ''}
    ${gone.length ? fold('fd-q-' + key, `Stopped this session (${gone.length})`, billList(gone, { why: true }), { open: !mv.length && !law.length }) : ''}`;
}
// Nothing typed yet: HIPHI's lists, the issues, and bills that need voices this week. The page keeps one main
// button: the first suggestion is a full action card, and the others are plain bill rows beside it (under it on a
// phone), each a press away from its own page.
function browseHTML() {
  const si = sessionInfo(), off = si.phase !== 'in', lists = S.lists || [];
  const [first, ...rest] = off ? [] : suggestions();
  return `${off ? `<div class="fd-offnote">${notice('info', 'calendar', `The Legislature is on break until <b>${esc(openWords(si))}</b>. You can still look up any ${si.recapYear} bill and see what happened to it.`)}</div>` : ''}
    ${lists.length ? `<section aria-labelledby="fd-lists-h">${sechead('fd-lists-h', 'Lists from HIPHI')}
      <p class="small muted fd-sub">${off ? `Follow a list now and its ${nextYear(si)} bills will appear in My bills as HIPHI adds them.` : 'Follow a list to follow its bills, plus any HIPHI adds later.'}</p>
      ${listCards(lists)}</section>` : ''}
    <section aria-labelledby="fd-iss-h">${sechead('fd-iss-h', 'Browse by issue')}${issueTiles()}</section>
    ${first ? `<section aria-labelledby="fd-voices-h">${sechead('fd-voices-h', 'Bills that need voices this week')}
      <p class="small muted fd-sub">Each one has a hearing coming up. Speaking up takes a few minutes.</p>
      <div class="cols fd-voices"><div class="fd-cards">${actionCard(first.b, first.st.hearing, { suggest: reason(first.b) })}</div>
        ${rest.length ? `<div class="side"><h3 class="fd-sideh" id="fd-also-h">More bills with a hearing this week</h3>
          ${billList(rest.map(r => r.b), b => ({ pos: true, hearing: rest.find(r => r.b.id === b.id)?.st.hearing }), { compact: true })}</div>` : ''}</div></section>` : ''}`;
}

// ---------------- an issue's page ----------------
function loadIssue(g) {
  F.issues[g.key] = 'loading';
  browseCoalition(g.key).then(async () => { const rows = (S.browse?.rows || []).slice(); await ensureHearings(rows); F.issues[g.key] = rows; })
    .catch(e => { console.error(e); F.issues[g.key] = 'err'; })
    .finally(() => app.render());
}
function issuePage(slug) {
  const g = issueBySlug(slug);
  if (!g) return `<div class="fd" data-page="issue">${back('#/find', 'Find')}${emptyBox({ h: 'h1', title: 'We couldn’t find that issue', text: 'It may have a new name. Here are all of HIPHI’s issues.', action: btn('See all issues', { kind: 'primary', href: '#/find' }) })}</div>`;
  const data = F.issues[g.key];
  if (data === undefined) loadIssue(g);
  const si = sessionInfo(), off = si.phase !== 'in', ready = Array.isArray(data);
  const mv = ready ? data.filter(moving) : [], law = ready ? data.filter(becameLaw).sort(numCmp) : [], gone = ready ? data.filter(stopped).sort(numCmp) : [];
  // Where the issue stands, in one line (bills, not people, so small numbers are fine). The recap card says it between sessions.
  const tally = ready && !off ? [mv.length ? `${mv.length} moving` : '', law.length ? `${law.length} became law` : '', gone.length ? `${gone.length} stopped this session` : ''].filter(Boolean).join(' · ') : '';
  const head = `${back('#/find', 'All issues')}<header class="fd-ihead"><span class="fd-icon">${icon(g.icon)}</span><h1 class="hero">${esc(g.key)}</h1>${g.description ? `<p class="lede">${esc(g.description)}</p>` : ''}${tally ? `<p class="meta">${esc(tally)}</p>` : ''}</header>`;
  if (!ready) return `<div class="fd" data-page="issue">${head}${data === 'err' ? `<div class="fd-err">${inlineErr('fd-ierr', 'We couldn’t load these bills. Check your connection and try again.')}${btn('Try again', { kind: 'secondary', icon: 'rotate-ccw', attrs: { 'data-reissue': g.key } })}</div>` : skeleton(3)}</div>`;
  // HIPHI's picks are its strongest positions; among them, the one with the soonest hearing or deadline leads.
  const picks = byUrgency(curate(data, 3).picks);
  const others = mv.filter(b => !picks.includes(b));
  const othersSorted = [...byUrgency(others.filter(b => posInfo(b))).sort((a, b) => (POS_RANK[a.hiphi_position] ?? 9) - (POS_RANK[b.hiphi_position] ?? 9)), ...byUrgency(others.filter(b => !posInfo(b)))];
  const todo = picks.filter(b => !S.watch.has(b.id));
  let top = '';
  if (off) {
    top = `<div class="card fd-recap"><p>In ${si.recapYear}, HIPHI worked on <b>${data.length} ${esc(g.key)} ${data.length === 1 ? 'bill' : 'bills'}</b>. ${law.length ? `<b>${law.length}</b> became law.` : 'None became law this time. Good ideas often come back the next year.'}</p>
      <p class="small muted">The next session opens ${esc(openWords(si))}.</p></div>`;
  } else if (picks.length) {
    const label = todo.length === picks.length ? (picks.length === 1 ? 'Follow this bill' : `Follow these ${picks.length}`) : `Follow the other ${todo.length}`;
    top = `<section aria-labelledby="fd-picks-h">${sechead('fd-picks-h', 'HIPHI’s picks')}
      <p class="small muted fd-sub">The bills HIPHI is pushing hardest on this issue right now.</p>
      ${billList(picks, { pos: true })}
      <div class="fd-cta">${todo.length ? btn(label, { kind: 'primary', icon: 'star', full: true, attrs: { 'data-followpicks': todo.map(b => b.id).join(',') } })
        : `<p class="okmsg" id="fd-picksok" tabindex="-1">${icon('circle-check')}You follow ${picks.length === 1 ? 'this pick' : `all ${picks.length}`}. They’re in My bills.</p>`}</div></section>`;
  } else {
    top = `<div class="fd-quiet">${notice('info', 'hourglass', `Nothing on ${esc(g.key)} is moving right now. New bills show up here as soon as HIPHI takes them on.`)}</div>`;
  }
  const otherSec = othersSorted.length ? `<section aria-labelledby="fd-oth-h">${sechead('fd-oth-h', picks.length ? 'Other bills moving' : 'Bills moving', plural(othersSorted.length, 'bill'))}${capped('i:' + g.key, othersSorted, { pos: true })}</section>` : '';
  const lawSec = law.length ? `<section aria-labelledby="fd-law-h">${sechead('fd-law-h', 'Became law', plural(law.length, 'bill'))}${billList(law, { pos: true })}</section>` : '';
  const goneSec = gone.length ? fold('fd-i-' + g.key, `Stopped this session (${gone.length})`, billList(gone, { why: true })) : '';
  return `<div class="fd" data-page="issue">${head}${top}${otherSec}${lawSec}${goneSec}</div>`;
}

// ---------------- a HIPHI list's page ----------------
function loadList(slug) {
  F.lists[slug] = 'loading';
  listBillsFor(slug).then(async rows => { await ensureHearings((rows || []).map(r => r.b)); F.lists[slug] = 'ready'; })
    .catch(e => { console.error(e); F.lists[slug] = 'err'; })
    .finally(() => app.render());
}
function listPage(slug) {
  const l = listBySlug(slug);
  if (!l) return `<div class="fd" data-page="list">${back('#/find', 'Find')}${emptyBox({ h: 'h1', title: 'We couldn’t find that list', text: 'HIPHI may have retired it. Here are the lists and issues you can follow now.', action: btn('See all lists', { kind: 'primary', href: '#/find' }) })}</div>`;
  if (F.lists[slug] === undefined) loadList(slug);
  const rows = F.lists[slug] === 'ready' ? S.listBills[slug] || [] : null;
  const fans = countOk(l.followers);   // people: only from 10
  const header = `<header class="fd-ihead"><span class="fd-icon">${icon(issueIcon(l.icon, 'list'))}</span><h1 class="hero">${esc(l.title)}</h1>
    ${l.description ? `<p class="lede">${esc(l.description)}</p>` : ''}
    <p class="meta">Picked by ${esc(l.curated_by || 'HIPHI')}${rows ? ` · ${plural(rows.length, 'bill')}` : ''}${fans ? ` · ${fans} people follow it` : ''}</p></header>`;
  if (!rows) return `<div class="fd" data-page="list">${back('#/find', 'All lists')}${header}${F.lists[slug] === 'err' ? `<div class="fd-err">${inlineErr('fd-lerr', 'We couldn’t load this list. Check your connection and try again.')}${btn('Try again', { kind: 'secondary', icon: 'rotate-ccw', attrs: { 'data-relist': slug } })}</div>` : skeleton(3)}</div>`;
  const note = Object.fromEntries(rows.map(r => [r.b.id, r.note || '']));
  const mv = byUrgency(rows.map(r => r.b).filter(moving)), law = rows.map(r => r.b).filter(becameLaw), gone = rows.map(r => r.b).filter(stopped);
  const si = sessionInfo(), off = si.phase !== 'in', on = S.listFollows.has(l.id), account = !!(S.user && !DEMO);
  let cta;
  if (on) {
    // A list with nothing moving (always the case between sessions) has added no bills, so the card says what will
    // happen instead of cheering a follow of nothing (assessment 9/19: "Following 0 bills" with a green check).
    const promise = listPromise(l);
    cta = `<div class="card fd-follow on"><p class="okmsg" id="fd-listok" tabindex="-1">${icon('circle-check')}<span>${promise ? esc(promise.lead.replace(/\.$/, '')) : 'You follow this list'}</span></p>
      <p class="small">${promise ? esc(promise.rest) : 'When HIPHI adds a bill to it, the bill shows up in My bills.'}</p>
      <div>${btn('Stop following this list', { kind: 'text', sm: true, attrs: { 'data-unfollowlist': slug } })}</div></div>`;
  } else {
    // Following a list follows only what can still be acted on (walkthrough 9/18: following "Keiki health" added
    // four stopped bills).
    const [label, sub] = !mv.length ? ['Follow this list', off ? `The ${si.recapYear} session is over, so nothing on it is moving. Follow it now and its ${nextYear(si)} bills will appear in My bills as HIPHI adds them.` : 'Nothing on it is moving right now. Bills HIPHI adds later will follow too.']
      : account ? ['Follow this list', 'Its moving bills join My bills, and so will any bill HIPHI adds later.']
      : mv.length === rows.length ? [mv.length === 1 ? 'Follow this bill' : `Follow all ${mv.length} bills`, 'New bills HIPHI adds to this list will follow too.']
      : [`Follow the ${plural(mv.length, 'bill')} still moving`, `New bills HIPHI adds will follow too. The ${gone.length + law.length} that finished stay listed below.`];
    cta = `<div class="fd-cta fd-follow">${btn(esc(label), { kind: 'primary', icon: 'star', full: true, attrs: { 'data-followlist': slug } })}<p class="small muted">${esc(sub)}</p></div>`;
  }
  const opt = b => ({ note: note[b.id], pos: true });
  const mvSec = mv.length ? `<section aria-labelledby="fd-lmv-h">${sechead('fd-lmv-h', 'Still moving', plural(mv.length, 'bill'))}${billList(mv, opt)}</section>`
    : rows.length ? '' : `<p class="fd-none">Nothing on this list yet. HIPHI adds bills as the session goes.</p>`;
  const lawSec = law.length ? `<section aria-labelledby="fd-llaw-h">${sechead('fd-llaw-h', 'Became law', plural(law.length, 'bill'))}${billList(law, opt)}</section>` : '';
  const goneSec = gone.length ? fold('fd-l-' + slug, `Stopped this session (${gone.length})`, billList(gone, b => ({ note: note[b.id], why: true })), { open: !mv.length && !law.length }) : '';
  return `<div class="fd" data-page="list">${back('#/find', 'All lists')}<div class="fd-lhead">${header}${cta}</div>${mvSec}${lawSec}${goneSec}</div>`;
}
// Following a list. One message at most, and it has to be true: with bills still moving a toast says how many were
// added (with Undo where this browser holds the follows); with none, nothing pops up over the page and the card
// that replaces the button says what will happen.
async function followListNow(slug) {
  const l = listBySlug(slug); if (!l) return;
  const rows = await listBillsFor(slug) || [], live = rows.filter(r => moving(r.b));
  S.fdFocus = '#fd-listok';
  if (S.user && !DEMO) {   // signed in: the database follows the list and its moving bills, and keeps adding new ones
    await followList(slug, true);   // core says "Following n bills on …" itself
    if (!S.listFollows.has(l.id)) { S.fdFocus = '[data-followlist]'; app.render(); return; }   // it did not work (core said why): give the button back
    if (!live.length) { const box = document.getElementById('toast'); if (box) box.innerHTML = ''; }   // …but never "Following 0 bills"
    return;
  }
  const add = live.filter(r => !S.watch.has(r.b.id)).map(r => r.b.id);
  S.listFollows.add(l.id); saveListFollows();
  add.forEach(id => S.watch.add(id)); saveLocal();
  try { await loadBills(); } catch (e) { console.error(e); }
  nudge('follow');
  app.render();
  if (add.length) toast(`Following ${plural(add.length, 'bill')} from “${l.title}”. Any HIPHI adds later will follow too.`, { yay: true,
    undo: async () => { S.listFollows.delete(l.id); saveListFollows(); add.forEach(id => S.watch.delete(id)); saveLocal(); S.fdFocus = '[data-followlist]'; await loadBills(); } });
}
async function unfollowListNow(slug) {
  const l = listBySlug(slug); if (!l) return;
  S.fdFocus = '[data-followlist]';   // the button that takes this one's place
  if (S.user && !DEMO) { await followList(slug, false); return; }   // core says "You no longer follow …" itself
  S.listFollows.delete(l.id); saveListFollows(); app.render();
  const kept = (S.listBills[slug] || []).some(r => S.watch.has(r.b.id));
  toast(`You stopped following “${l.title}”.${kept ? ' Its bills stay in My bills.' : ''}`);
}

// ---------------- wiring ----------------
function wireRegion(root, links) {
  if (!root) return;
  wireRows(root);
  wireActions(root);
  // Results painted in place were not there when app.js wired the page's links; keep them in the app.
  if (links) root.querySelectorAll('a[href^="#/"]').forEach(a => a.addEventListener('click', e => { if (e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); app.go(a.getAttribute('href')); }));
  root.querySelectorAll('[data-fdmore]').forEach(el => el.onclick = () => {
    const k = el.dataset.fdmore, from = +el.dataset.from || 0; F.more[k] = true;
    document.getElementById('fd-results') ? paint() : app.render();
    // Keep the place: focus the first bill that was just revealed.
    document.querySelector(`[data-grp="${CSS.escape(k)}"] .mb-row:nth-child(${from + 1}) .mb-main`)?.focus({ preventScroll: true });
  });
  root.querySelectorAll('[data-retry]').forEach(el => el.onclick = () => { F.cache.delete(F.key); F.key = null; if (F.cur) startSearch(F.cur); paint(); });
  // "Not for me" swaps the card for the next suggestion, and the button that was pressed is gone with it. Put
  // keyboard focus on the new card's headline (after the shared handler has redrawn the page), not at the top.
  root.querySelectorAll('.fd-cards [data-notforme]').forEach(el => el.addEventListener('click', () => setTimeout(() => {
    (document.querySelector('.fd-cards .achead a') || document.getElementById('fd-iss-h')?.closest('section')?.querySelector('a') || document.getElementById('main'))?.focus({ preventScroll: true }); }, 0)));
}
function wirePage(root) {
  wireRows(root);
  root.querySelectorAll('[data-fdmore]').forEach(el => el.onclick = () => { F.more[el.dataset.fdmore] = true; const from = +el.dataset.from || 0, k = el.dataset.fdmore; app.render();
    document.querySelector(`[data-grp="${CSS.escape(k)}"] .mb-row:nth-child(${from + 1}) .mb-main`)?.focus({ preventScroll: true }); });
  root.querySelectorAll('[data-reissue]').forEach(el => el.onclick = () => { delete F.issues[el.dataset.reissue]; app.render(); });
  root.querySelectorAll('[data-relist]').forEach(el => el.onclick = () => { delete F.lists[el.dataset.relist]; app.render(); });
  root.querySelectorAll('[data-followpicks]').forEach(el => el.onclick = async () => {
    const ids = el.dataset.followpicks.split(',').filter(id => !S.watch.has(id)); if (!ids.length) return;
    el.setAttribute('aria-busy', 'true'); el.innerHTML = `${icon('loader-circle')}<span>Following…</span>`;
    const done = [];
    for (const id of ids) { await toggleWatch(id); if (S.watch.has(id)) done.push(id); }
    if (!done.length) return;   // toggleWatch already said what went wrong
    S.fdFocus = '#fd-picksok'; app.render();
    toast(`Following ${plural(done.length, 'bill')}. Mahalo!`, { yay: true, undo: async () => { S.fdFocus = '[data-followpicks]'; for (const id of done) if (S.watch.has(id)) await toggleWatch(id); } });
  });
  root.querySelectorAll('[data-followlist]').forEach(el => el.onclick = async () => {
    el.setAttribute('aria-busy', 'true'); el.innerHTML = `${icon('loader-circle')}<span>Following…</span>`;
    try { await followListNow(el.dataset.followlist); } catch (e) { toast(e, true); app.render(); }
  });
  root.querySelectorAll('[data-unfollowlist]').forEach(el => el.onclick = async () => { try { await unfollowListNow(el.dataset.unfollowlist); } catch (e) { toast(e, true); } });
  if (S.fdFocus) { const t = root.querySelector(S.fdFocus); S.fdFocus = null; t?.focus({ preventScroll: true }); }
}
function wireSearch() {
  const inp = document.getElementById('q'), form = document.querySelector('.fd-search'), clr = document.querySelector('.fd-clear');
  if (!inp || !form) return;
  const typed = () => {
    clr.hidden = !inp.value;
    F.pending = !!inp.value.trim(); setBusy();
    clearTimeout(F.t); F.t = setTimeout(() => { F.pending = false; runQuery(inp.value); }, 300);
  };
  inp.addEventListener('input', typed);
  // Wide screens also have a search box in the header. On this page the two are one search: typing in either
  // fills the other and updates the results underneath.
  const hq = document.getElementById('hq');
  if (hq) { if (hq.value !== inp.value && hq !== document.activeElement) hq.value = inp.value; hq.addEventListener('input', () => { inp.value = hq.value; typed(); }); }
  // Search on the keyboard closes the keyboard so the results are in view.
  form.addEventListener('submit', e => { e.preventDefault(); clearTimeout(F.t); F.pending = false; inp.blur(); runQuery(inp.value); });
  clr.onclick = () => { inp.value = ''; clr.hidden = true; clearTimeout(F.t); F.pending = false; runQuery(''); inp.focus(); };
  const st = document.getElementById('fd-status');
  if (st && F.cur && F.res && !F.busy) st.textContent = F.res.length ? `${plural(F.res.length, 'bill')} found` : 'No bills found';
}

export default {
  tab: 'find',
  title: r => r.name === 'issue' ? (issueBySlug(r.slug)?.key || 'Issue') : r.name === 'list' ? (listBySlug(r.slug)?.title || 'List') : r.q ? `“${r.q}”` : 'Find bills',
  render(r) { return r.name === 'issue' ? issuePage(r.slug) : r.name === 'list' ? listPage(r.slug) : findPage(r.q); },
  wire(r) {
    const root = document.querySelector('.fd'); if (!root) return;
    if (r.name === 'find') { wireSearch(); wireRegion(document.getElementById('fd-results'), false); if (S.fdFocus) { root.querySelector(S.fdFocus)?.focus({ preventScroll: true }); S.fdFocus = null; } }
    else { wirePage(root); wireActions(root); }
  },
};
