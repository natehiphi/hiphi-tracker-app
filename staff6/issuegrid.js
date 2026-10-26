// My issues › All issues as a grid of cards, and the card shapes the Coalitions tab shares (R-336 walk 3). Nate: "This
// needs to be the most organized. There are dozens of issues and it's hard to keep them all straight. One big list is far
// too hard to find what you're looking for. It's possible these should be organized like the legislator list. Each issue has
// it's own image with a description so it doesn't feel overly daunting when looking at them. We want this to feel very warm
// and welcoming." His pick for the image: the issue's topic icon, large, on a soft tint (each topic its own tint).
//
// Built like Legislators › Everyone (legislators.js): groups with a heading and a count, a row of jump chips over them (the
// chips are Everyone's own, .lg6-jump, so the two directories behave alike), a Sort button that opens a picker, and one card
// per item that is one link. Three sorts replace R-272's two-way switch (A-25: nothing else is added to the screen):
//   By topic (the default): the six topics in their order, each issue A to Z inside its topic, so a name is found where a
//     person expects it (Nate's "hard to find"); urgency is said on each card's status line, and By next deadline orders by it.
//   A to Z: one continuous grid, the first card of each letter wearing the letter (Everyone's A to Z).
//   By next deadline: R-272's order and groups (issuestand.js deadlineGroups: This week, Next deadlines, Safe for now, and
//     the folds for what is not moving and what has no bills), the old default, kept for the season's work.
// Each card (C-14 on v6: a name and one short line, here two): the topic's icon on its tint, the issue's name (18px, 500),
// one line of its description cut at a word (the whole of it in the title and on the issue's page), and ONE status line
// in words with an icon (A-5: never colour alone): "At risk: SB 11 needs a hearing by Thu 3/19", "Your step: testimony due
// today 9:30 AM", "2 bills alive · House and Senate", "No bills this session". At most four facts a card (spec 8).
// The find box is R-272's (issuestand.js searcher: words in any order, bill numbers with or without the space).
import { S, SESSION_OVER, esc } from './data.js';
import { stopOf, whenAt, lateLine } from './model.js';
import { icon, iconBtn, btn, pickerSheet, andWords } from './ui.js';
import { ICONS } from '../icons.js';
import { plural } from './lists.js';
import { standOf, markOf, hearPart, deadlineGroups, searcher, numNb } from './issuestand.js';
import { nw } from './steps.js';

// ---- the picture: an icon on a soft tint ----
// Six tints, in the topics' order (tokens in issues.css .ig6-tint1..6, each a wash of one hue with a darker ink of the same
// hue for the icon). A topic or coalition takes its tint by its place in its list, so a seventh wraps round.
export const TINTS = 6;
export const tintOf = n => `ig6-tint${(((n % TINTS) + TINTS) % TINTS) + 1}`;
// The apple stays a salad on Staff until Nate picks Food's new icon on R-339's round-2 sheet (bills.js STAFF_TOPIC_IC).
const STAFF_IC = { apple: 'salad' };
export const staffIcon = name => { const n = STAFF_IC[name] || name; return ICONS[n] ? n : ''; };
const catOf = k => (S.categories || []).find(c => c.key === k) || null;
const catIndex = k => (S.categories || []).findIndex(c => c.key === k);
// The picture: the icon, or a monogram ("FS" for Farm to School) when there is none. Decorative: the card's name says it.
export const picHTML = ({ ic = '', mono = '', tint = 0, small = false } = {}) =>
  `<span class="ig6-pic ${tintOf(tint)}${small ? ' ig6-pic-sm' : ''}" aria-hidden="true">${ic ? icon(ic) : `<span class="ig6-mono">${esc(mono)}</span>`}</span>`;
export const monogram = name => { const w = String(name || '').replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
  return (w.length > 1 && !/^[A-Z]{2,}$/.test(w[0]) ? w.slice(0, 2).map(x => x[0]) : [w[0]?.slice(0, 2) || '?']).join('').toUpperCase(); };

// ---- a card ----
// The whole card is one link (rule 10: focus ring on it, Back puts the focus on it again). `foot`: a control that sits on the
// card outside the link (the Coalitions tab's I help); `letter`: A to Z's corner badge; `lines`: [html, cls, fit] (fit: the
// words fitLines fits to the line's box).
export function cardHTML({ key, href, name, title = '', pic, lines = [], foot = '', letter = '', anchor = '' }) {
  return `<div class="ig6-cell" role="listitem" data-igcard="${esc(key)}"${anchor ? ` id="${esc(anchor)}"` : ''}><div class="ig6-card${foot ? ' has-foot' : ''}">
    <a class="ig6-link" href="${esc(href)}"${title ? ` title="${esc(title)}"` : ''}>${pic}${letter ? `<span class="ig6-badge" aria-hidden="true">${esc(letter)}</span>` : ''}<span class="ig6-body"><span class="ig6-name">${esc(name)}</span>${lines.filter(l => l && l[0]).map(([h, c, fit]) => `<span class="${c}"${fit ? ` data-fit="${esc(fit)}"` : ''}>${h}</span>`).join('')}</span></a>
    ${foot ? `<div class="ig6-foot">${foot}</div>` : ''}</div></div>`;
}
export const gridHTML = (inner, label) => `<div class="ig6-grid" role="list" aria-label="${esc(label)}">${inner}</div>`;
// A group: its heading (22px) with a small picture and its count, a target for its chip; then its grid.
export const groupHTML = g => `<section class="ig6-sec" aria-labelledby="${esc(g.id)}"><div class="ig6-sh">${g.pic || ''}<h2 id="${esc(g.id)}" tabindex="-1">${esc(g.title)}</h2>${g.count ? `<span class="ig6-sn">${esc(g.count)}</span>` : ''}</div>${g.body || gridHTML(g.inner, g.title)}</section>`;
// The jump chips: Everyone's (legislators.css .lg6-jump), one per group, each bringing its heading to the top.
export const jumpHTML = (gs, label) => gs.length < 2 ? '' : `<nav class="lg6-jump ig6-jump" aria-label="${esc(label)}"><div class="lg6-jrow">${gs.map(g =>
  `<button type="button" class="lg6-jchip" data-igjump="${esc(g.id)}">${esc(g.chip || g.title)}${g.n != null ? ` <span class="lg6-jn">${g.n}</span>` : ''}</button>`).join('')}</div></nav>`;
// Wires the chips: a chip scrolls its group's heading (or A to Z's first card of that letter) to the top and puts the focus
// there, so Tab carries on from it; a folded group opens first. The row slides sideways on a phone, its edge fading where
// more chips wait (the page tabs' and Everyone's rule, A-12 on v6).
export function wireJump(root) {
  root.querySelectorAll('[data-igjump]').forEach(b => b.onclick = () => {
    const h = root.querySelector('#' + CSS.escape(b.dataset.igjump)); if (!h) return;
    const fold = h.closest('details'); if (fold && !fold.open) fold.open = true;
    let calm = true; try { calm = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { /* old browser */ }
    (h.closest('section, details') || h).scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' });
    (h.matches('h2, summary') ? h : h.querySelector('a'))?.focus({ preventScroll: true });
  });
  // A fold's cards have no size while it is closed: they are fitted when it opens.
  root.querySelectorAll('details.ig6-fold').forEach(d => d.addEventListener('toggle', () => { if (d.open) fitLines(d); }));
  const r = root.querySelector('.ig6-jump .lg6-jrow'); if (!r) return;
  const set = () => { const over = r.scrollWidth > r.clientWidth + 1; r.classList.toggle('ovf', over); r.classList.toggle('atstart', r.scrollLeft <= 1); r.classList.toggle('atend', r.scrollLeft + r.clientWidth >= r.scrollWidth - 1); };
  set(); r.addEventListener('scroll', set, { passive: true });
}
// Fits each description to its two lines: drops whole words from the end, then adds "…", until the line box holds it.
// Chromium sometimes measures a changed line one frame late (a line that ends exactly at the box's edge), so what still runs
// over a moment later is trimmed again from where it stopped.
const over = e => e.scrollHeight > e.clientHeight + 2;
function trim(e, words) {
  const ws = words.replace(/…$/, '').split(' ');
  while (ws.length > 2 && over(e)) { ws.pop(); e.textContent = ws.join(' ').replace(/[\s,;:–—-]+$/, '') + '…'; }
}
export function fitLines(root = document) {
  // Lato arrives after the first draw and is narrower or wider than the stand-in: fit again once it has.
  try { if (document.fonts && document.fonts.status !== 'loaded') document.fonts.ready.then(() => fitLines(root)); } catch { /* old browser */ }
  const els = [...root.querySelectorAll('.ig6-desc[data-fit]')];
  for (const e of els) { const full = e.dataset.fit; if (e.textContent !== full) e.textContent = full; if (over(e)) trim(e, full); }
  setTimeout(() => { for (const e of els) if (e.isConnected && over(e)) trim(e, e.textContent); }, 80);
}
let fitT = 0;
try { addEventListener('resize', () => { clearTimeout(fitT); fitT = setTimeout(() => fitLines(), 120); }); } catch { /* not a browser */ }
// Rule 10: Back from an issue or a coalition puts the focus on the card it was opened from (issuestand.js rememberRow sets
// S.i6Back on that page; this is restoreRow for cards).
let popAt = 0;
try { addEventListener('popstate', () => { popAt = Date.now(); }); } catch { /* not a browser */ }
export function restoreCard(root) {
  const id = S.i6Back; if (!id) return; S.i6Back = null;
  setTimeout(() => {
    if (Date.now() - popAt > 2500) return;
    const a = root.querySelector(`[data-igcard="${CSS.escape(id)}"] .ig6-link`); if (!a) return;
    a.focus({ preventScroll: true });
    const r = a.getBoundingClientRect(); if (r.top < 0 || r.bottom > innerHeight) a.scrollIntoView({ block: 'center' });
  }, 30);
}
const narrow = () => { try { return matchMedia('(max-width: 767px)').matches; } catch { return false; } };

// ---- an issue's words ----
// The description's line: its first sentence, cut at a word to what two lines of the card hold. The card's width changes
// with the window (about 114 to 200px), so the words are first cut generously here and then fitted in the page (fitLines,
// after each draw and on resize): whole words only, then "…", never a word cut by the box. The whole description is the
// card's title and leads the issue's page.
export function cutWords(t, max) {
  t = String(t || '').trim().replace(/\s+/g, ' '); if (!t) return '';
  const first = (/^(.+?[.!?])(\s|$)/.exec(t) || [, t])[1].replace(/\.$/, '');
  if (first.length <= max) return first;
  const cut = first.slice(0, max + 1), at = Math.max(cut.lastIndexOf(' '), 0);
  return (at > max * 0.5 ? cut.slice(0, at) : cut.slice(0, max)).replace(/[\s,;:–—-]+$/, '') + '…';
}
// Where an issue's live bills are now: "House and Senate", "in the Senate", "with the Governor".
function whereWords(bills) {
  const at = new Set();
  for (const b of bills) { const st = stopOf(b);
    if (st.phase === 'governor') at.add('G'); else if (st.phase === 'law') at.add('L');
    else if (st.chamber === 'H' || st.chamber === 'S') at.add(st.chamber);
    else { const m = /^(H|S)/i.exec(b.bill_number || ''); if (m) at.add(m[1].toUpperCase()); } }
  const ws = [at.has('H') ? 'House' : '', at.has('S') ? 'Senate' : '', at.has('G') ? 'the Governor' : '', at.has('L') ? 'law' : ''].filter(Boolean);
  if (!ws.length) return '';
  if (ws.length === 1) return ws[0] === 'the Governor' ? 'with the Governor' : ws[0] === 'law' ? 'law now' : `in the ${ws[0]}`;
  return andWords(ws);
}
const aliveWords = x => { const n = x.going.length, w = whereWords(x.going); return `${plural(n, 'bill')} alive${w ? ` · ${w}` : ''}`; };
// The hearing that leads, in words: the viewer's own step says so; the testimony states are those of steps.js.
function hearWords(x) {
  const hp = hearPart(x); if (!hp) return null;
  const { h } = x.hear, s = hp.s;
  if (!s?.state) return { ic: 'calendar-days', text: `Hearing ${whenAt(h.scheduled_at)}` };
  const k = s.state.key;
  if (k === 'filed') return { ic: 'circle-check', text: `Testimony filed, hearing ${whenAt(h.scheduled_at)}` };
  if (k === 'missed') return { ic: 'circle-x', text: 'Testimony missed' };
  const who = hp.you ? 'Your step: testimony' : 'Testimony';
  if (hp.late) return { ic: hp.tone ? hp.ic : 'clock', tone: hp.tone, text: `${who} ${lateLine(s.until, { lower: true })}` };
  if (s.due != null) return { ic: hp.tone ? hp.ic : 'clock', tone: hp.tone, soon: hp.soon, text: `${who} due ${whenAt(s.due)}` };
  return { ic: 'calendar-days', text: `Hearing ${whenAt(h.scheduled_at)}` };
}
// The card's one status line. At risk and a dying bill lead (Nate, R-272: "see what issues are at risk of dying"), then the
// hearing, then a bill that needs a hearing by the next deadline, then how many bills are alive and where.
export function statusOf(x) {
  const m = markOf(x);
  if (['risk', 'dying'].includes(x.state)) return { ic: m.ic, text: m.text };
  const hw = hearWords(x); if (hw) return hw;
  switch (x.state) {
    case 'none': return { ic: 'circle-dashed', text: 'No bills this session' };
    case 'off': case 'stopped': return m ? { ic: m.ic || 'circle-minus', text: m.text } : null;
    case 'oppose': return { ic: 'circle-x', text: `HIPHI opposes it · ${plural(x.going.length, 'bill')} alive` };
    case 'ahead': if (x.facing?.length && m) return { ic: m.ic, text: m.text };
  }
  return x.going.length ? { ic: x.state === 'safe' ? 'shield-check' : 'circle-dot', text: aliveWords(x) } : null;
}
const statusHTML = st => !st ? null : [`${icon(st.ic || 'circle-dot')}<span>${nw(esc(st.text))}</span>`, `ig6-stat${st.tone && st.tone !== 'neutral' ? ' t-' + st.tone : ''}${st.soon ? ' soon' : ''}`];

// One issue's card. `why`: the bill a search found it by, said on the status line when the line does not name it already.
function issueCard(x, { tags = [], why = null, letter = '', anchor = '' } = {}) {
  const { i } = x, c = catOf(i.category);
  let st = statusOf(x);
  // A search that found it by a bill says which, unless the line names that bill already (numbers carry a no-break space).
  const sp = s => String(s || '').replace(/\u00a0/g, ' '), nb = why ? numNb(why) : '';
  if (why && !sp(st?.text).includes(sp(nb))) st = { ic: 'search', text: `Found by its bill ${sp(nb)}` };
  const desc = cutWords(i.description, 96);
  // A quiet tag ("Not public yet", "Not in the first visit") takes the description's line: it is what staff need to know
  // about that issue, and the card stays four facts and the same height (the description is still the title).
  const line = tags.length ? [esc(tags.join(', ')), 'ig6-desc ig6-tag'] : [desc ? esc(desc) : '', 'ig6-desc', desc];
  return cardHTML({ key: i.id, href: '#/issue/' + encodeURIComponent(i.id), name: i.name, title: i.description || '', letter, anchor,
    pic: picHTML({ ic: staffIcon(c?.icon || '') || 'tag', tint: Math.max(catIndex(i.category), 0) }),
    lines: [line, statusHTML(st)] });
}

// ---- the sorts ----
export const SORTS = [['topic', 'By topic'], ['name', 'A to Z'], ['deadline', 'By next deadline']];
const KEY = 'sv6_allissues_sort';
export function sortOf() {
  if (S.igSort) return S.igSort;
  let v = ''; try { v = localStorage.getItem(KEY) || ''; } catch { /* a private window */ }
  return SORTS.some(s => s[0] === v) ? v : 'topic';
}
export const setSort = v => { S.igSort = v; try { localStorage.setItem(KEY, v); } catch { /* this visit only */ } };
const byName = (a, b) => a.i.name.localeCompare(b.i.name, 'en', { sensitivity: 'base' });
const WEEK = 7 * 864e5;
const atRisk = l => l.filter(x => x.state === 'risk').length, hearWeek = l => l.filter(x => x.hear && new Date(x.hear.h.scheduled_at) - Date.now() <= WEEK).length;
// "18 issues, 1 at risk, 3 with a hearing this week": one fact, commas (issuestand.js topicCount's words).
const countWords = l => [plural(l.length, 'issue'), atRisk(l) ? `${atRisk(l)} at risk` : '', hearWeek(l) ? `${hearWeek(l)} with a hearing this week` : ''].filter(Boolean).join(', ');

function topicGroups(list, o) {
  return (S.categories || []).map((c, k) => { const l = list.filter(x => x.i.category === c.key).sort(byName); if (!l.length) return null;
    return { id: `ig6-g-${c.key}`, title: c.name, chip: c.name, n: l.length, count: countWords(l), pic: picHTML({ ic: staffIcon(c.icon) || 'tag', tint: k, small: true }),
      inner: l.map(x => issueCard(x, { tags: o.tagsOf(x) })).join('') }; }).filter(Boolean)
    // An issue whose topic is not one of the six (a new key) still shows, last, rather than vanishing.
    .concat((() => { const keys = new Set((S.categories || []).map(c => c.key)), l = list.filter(x => !keys.has(x.i.category)).sort(byName);
      return l.length ? [{ id: 'ig6-g-other', title: 'No topic yet', chip: 'No topic', n: l.length, count: plural(l.length, 'issue'), inner: l.map(x => issueCard(x, { tags: o.tagsOf(x) })).join('') }] : []; })());
}
function letterGroups(list, o) {
  const by = new Map();
  for (const x of list.slice().sort(byName)) { const k = (x.i.name.normalize('NFD').replace(/[^\p{L}\p{N}]/gu, '')[0] || '#').toUpperCase(); if (!by.has(k)) by.set(k, []); by.get(k).push(x); }
  return [...by].map(([k, l]) => ({ id: `ig6-l-${/[A-Z0-9]/.test(k) ? k : 'x'}`, title: k, chip: k, flow: true,
    inner: l.map((x, n) => issueCard(x, { tags: o.tagsOf(x), letter: n ? '' : k, anchor: n ? '' : `ig6-l-${/[A-Z0-9]/.test(k) ? k : 'x'}` })).join('') }));
}
function deadlineGroupsOf(list, o) {
  return deadlineGroups(list).map(([k, title, l, folded]) => {
    if (!l.length) return k === 'week' ? { id: 'ig6-d-week', title, n: 0, quiet: true } : null;
    return { id: `ig6-d-${k}`, title, n: l.length, folded, count: folded ? '' : plural(l.length, 'issue'), inner: l.map(x => issueCard(x, { tags: o.tagsOf(x) })).join('') };
  }).filter(Boolean);
}
const sortWords = k => (SORTS.find(s => s[0] === k) || SORTS[0])[1].replace(/^By /, 'by ').replace(/^A to Z$/, 'A to Z');

// The body for the sort in force; a search shows its matches in one grid. `tagsOf(x)`: the quiet tags of an issue.
export function gridBody(issues, { q = '', tagsOf = () => [] } = {}) {
  const list = issues.map(standOf), o = { tagsOf };
  if (q.trim()) {
    const f = searcher(q), hits = f ? list.map(x => ({ x, m: f(x) })).filter(y => y.m) : [];
    if (!hits.length) return `<p class="i6-quiet">No issue matches “${esc(q.trim())}”. Try a bill number, a bill’s nickname or another word for it.</p>`;
    hits.sort((a, b) => a.m.score - b.m.score || byName(a.x, b.x));
    return `<p class="i6-found" role="status">${plural(hits.length, 'issue')} ${hits.length === 1 ? 'matches' : 'match'}</p>${gridHTML(hits.map(({ x, m }) => issueCard(x, { tags: tagsOf(x), why: m.why })).join(''), 'Issues found')}`;
  }
  let key = sortOf();
  // Between sessions there are no hearings or deadlines to order by: said once, and the topics shown.
  const off = key === 'deadline' && SESSION_OVER;
  if (off) key = 'topic';
  const gs = key === 'name' ? letterGroups(list, o) : key === 'deadline' ? deadlineGroupsOf(list, o) : topicGroups(list, o);
  const label = `All ${plural(list.length, 'issue')}, ${sortWords(key)}: go to`;
  const nav = jumpHTML(gs.filter(g => !g.quiet), label);
  const note = off ? `<p class="i6-quiet">Between sessions there are no hearings or deadlines to sort by, so the issues are by topic until the next session opens.</p>` : '';
  if (key === 'name') return `${note}${nav}<div class="ig6-groups">${gridHTML(gs.map(g => g.inner).join(''), `All ${plural(list.length, 'issue')}, A to Z`)}</div>`;
  const body = gs.map(g => g.quiet ? `<p class="i6-quiet i6-weekq" id="${g.id}" tabindex="-1">${icon('calendar-check')}<span>No issue is at risk or has a hearing this week.</span></p>`
    : g.folded ? `<details class="i6-fold ig6-fold" data-fold="${esc(g.id)}"><summary id="${esc(g.id)}">${icon('chevron-down', { cls: 'i6-chev' })}<span>${esc(g.title)} (${g.n})</span></summary>${gridHTML(g.inner, g.title)}</details>`
    : groupHTML(g)).join('');
  return `${note}${nav}<div class="ig6-groups">${body}</div>`;
}

// ---- the tools: the find box, Sort, and (on a phone) New issue ----
// The find box stays open at every width here: with chips and cards under it, the box is the quickest way to an issue
// (Nate's "hard to find what you're looking for"). Sort opens a picker, as on Everyone; its label stays short and says the
// order to a screen reader. `extra`: the phone's New issue button.
export const toolsHTML = (q, { extra = '' } = {}) => `<div class="i6-tools ig6-tools open" data-istools="is-q">
    <div class="i6-find" id="is-q-find">${icon(ICONS['list-filter'] ? 'list-filter' : 'search')}<input id="is-q" type="search" placeholder="${narrow() ? 'Find an issue' : 'Find an issue or a bill'}" value="${esc(q)}" autocomplete="off" aria-label="Find an issue: a word, a bill number or a bill’s nickname" aria-controls="is-q-body">${iconBtn('x', 'Clear the box', { 'data-istq': 'clear', hidden: !q })}</div>
    ${btn('Sort', { kind: 'secondary', sm: true, iconEnd: 'chevron-down', cls: 'ig6-sortb', attrs: { 'data-igsort': '1', 'aria-haspopup': 'dialog', 'aria-label': `Sort, now ${sortWords(sortOf())}`, hidden: !!q.trim() } })}
    ${extra}
  </div>`;
export function pickSort(root, paint) {
  pickerSheet({ title: 'Sort the issues', value: sortOf(), options: SORTS.map(([k, l]) => [k, l]),
    onPick: v => { setSort(v); const b = root.querySelector('[data-igsort]'); if (b) b.setAttribute('aria-label', `Sort, now ${sortWords(v)}`); paint(); root.querySelector('[data-igsort]')?.focus(); } });
}
