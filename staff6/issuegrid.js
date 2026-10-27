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
import { whenAt, lateLine } from './model.js';
import { icon, iconBtn, btn, pickerSheet } from './ui.js';
import { ICONS } from '../icons.js';
import { plural } from './lists.js';
import { standOf, markOf, hearPart, deadlineGroups, searcher, numNb } from './issuestand.js';
import { nw } from './steps.js';
import { stateMark, issueKey, chamberDots } from './verbs.js';   // R-344 Rule 2: how an issue is doing, as a shape (Decision 4)

// ---- the picture: an icon on a soft tint ----
// Six tints, in the topics' order (tokens in issues.css .ig6-tint1..6, each a wash of one hue with a darker ink of the same
// hue for the icon). A topic takes its tint by its place in its list, so a seventh wraps round. Coalitions take the neutral
// wash (tint null): a topic's tint means that topic, never a coalition (the critic).
export const TINTS = 6;
export const tintOf = n => n == null ? 'ig6-tint0' : `ig6-tint${(((n % TINTS) + TINTS) % TINTS) + 1}`;   // null: the neutral wash
// The apple stays a salad on Staff until Nate picks Food's new icon on R-339's round-2 sheet (bills.js STAFF_TOPIC_IC).
const STAFF_IC = { apple: 'salad' };
export const staffIcon = name => { const n = STAFF_IC[name] || name; return ICONS[n] ? n : ''; };
// The icons the topics wear, as Staff shows them: a coalition whose icon is one of these takes a monogram instead, so a
// picture keeps one meaning (HEAL's salad is Food's on Staff, CTFH's crossed-out cigarette is Tobacco's).
export const topicIcons = () => new Set((S.categories || []).flatMap(c => [c.icon, staffIcon(c.icon)]).filter(Boolean));
const catOf = k => (S.categories || []).find(c => c.key === k) || null;
const catIndex = k => (S.categories || []).findIndex(c => c.key === k);
// An issue's picture wherever an issue is shown (R-339): its own icon (issues.icon, migration 188; Nate's picks) when that
// name is drawn in ICONS, else its topic's, else the tag. Topic headings keep the topic's icon.
export const issueIcon = i => staffIcon(i?.icon || '') || staffIcon(catOf(i?.category)?.icon || '') || 'tag';
// The picture: the icon, or a monogram ("FS" for Farm to School) when there is none. Decorative: the card's name says it,
// so the monogram is drawn by CSS (issues.css .ig6-mono::before), as Everyone draws a missing photo's initial, and is not
// read as one more fact of the card.
export const picHTML = ({ ic = '', mono = '', tint = 0, small = false } = {}) =>
  `<span class="ig6-pic ${tintOf(tint)}${small ? ' ig6-pic-sm' : ''}" aria-hidden="true">${ic ? icon(ic) : `<span class="ig6-mono" data-m="${esc(mono)}"></span>`}</span>`;
export const monogram = name => { const w = String(name || '').replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
  return (w.length > 1 && !/^[A-Z]{2,}$/.test(w[0]) ? w.slice(0, 2).map(x => x[0]) : [w[0]?.slice(0, 2) || '?']).join('').toUpperCase(); };

// ---- a card ----
// The whole card is one link (rule 10: focus ring on it, Back puts the focus on it again). `foot`: a control that sits on the
// card outside the link (the Coalitions tab's I help); `after`: a short name after the name, small and muted (a coalition's
// "· CHW"); `letter`: A to Z's corner badge; `lines`: [html, cls, fit] (fit: the
// words fitLines fits to the line's box).
export function cardHTML({ key, href, name, after = '', title = '', pic, lines = [], foot = '', letter = '', anchor = '', cls = '' }) {
  return `<div class="ig6-cell${cls ? ' ' + cls : ''}" role="listitem" data-igcard="${esc(key)}"${anchor ? ` id="${esc(anchor)}"` : ''}><div class="ig6-card${foot ? ' has-foot' : ''}">
    <a class="ig6-link" href="${esc(href)}"${title ? ` title="${esc(title)}"` : ''}>${pic}${letter ? `<span class="ig6-badge" aria-hidden="true">${esc(letter)}</span>` : ''}<span class="ig6-body"><span class="ig6-name">${esc(name)}${after ? `<span class="ig6-after"> · ${esc(after)}</span>` : ''}</span>${lines.filter(l => l && l[0]).map(([h, c, fit]) => `<span class="${c}"${fit ? ` data-fit="${esc(fit)}"` : ''}>${h}</span>`).join('')}</span></a>
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
  r.scrollLeft = 0;   // a phone's chip row starts at its first chip
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
// Where its live bills started, as the issue's page and My issues count it: "House and Senate" is a House bill (HB) and a
// Senate bill (SB) alive; one chamber alone is "House bills" or "a Senate bill".
function whereWords(bills) {
  const n = { H: 0, S: 0 };
  for (const b of bills) { const m = /^\s*(H|S)/i.exec(b.bill_number || ''); if (m) n[m[1].toUpperCase()]++; }
  if (n.H && n.S) return 'House and Senate';
  const k = n.H ? 'House' : n.S ? 'Senate' : '', c = n.H || n.S;
  return k ? (c === 1 ? `a ${k} bill` : `${k} bills`) : '';
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
    case 'oppose': return { ic: 'thumbs-down', text: `HIPHI opposes it · ${plural(x.going.length, 'bill')} alive` };   // the stance's shape (Rule 5: circle-x is Missed)
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
  // A quiet tag ("Not public yet") takes the description's line: it is what staff need to know about that issue, and the
  // card stays four facts and the same height (the description is still the title). "Not in the first visit" is a setting
  // of the public first visit (issues.js, 066), not a fact about the issue: it put a setting's words where the description
  // goes (R-344 D10, "Legal adult-use cannabis"), so it stays on the issue's own page with its switch.
  const shown = tags.filter(t => !/first visit/i.test(t));
  const line = shown.length ? [esc(shown.join(', ')), 'ig6-desc ig6-tag'] : [desc ? esc(desc) : '', 'ig6-desc', desc];
  // R-344 Rule 2, Decision 4: how the issue is doing as one shape and its word (On track, At risk, Stopped, Won, No bills
  // yet), neutral, no tint, with the House and Senate dots beside it. The status line then stops saying the state's word
  // (A-25), and a card with no bills says it once.
  const key = issueKey(x);
  if (st && key === 'risk') st = { ...st, text: String(st.text).replace(/^At risk: /, '').replace(/^\w/, c => c.toUpperCase()) };
  if (key === 'none' && st?.ic === 'circle-dashed') st = null;
  const state = [`${stateMark('issue', key, { size: 20, cls: 'ig6-state' })}${key !== 'none' ? chamberDots(x.going) : ''}`, 'ig6-sline'];
  return cardHTML({ key: i.id, href: '#/issue/' + encodeURIComponent(i.id), name: i.name, title: i.description || '', letter, anchor, cls: 'ig6-issue',
    // The issue's own icon (Nate's R-339 picks), else its topic's.
    pic: picHTML({ ic: issueIcon(i), tint: Math.max(catIndex(i.category), 0) }),
    lines: [line, statusHTML(st), state] });
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
// "1 at risk, 3 with a hearing this week": one fact, commas (issuestand.js topicCount's words). How many issues is the chip's
// number, so the heading does not say it again (A-14).
const countWords = l => [atRisk(l) ? `${atRisk(l)} at risk` : '', hearWeek(l) ? `${hearWeek(l)} with a hearing this week` : ''].filter(Boolean).join(', ');

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
const sortLabel = k => (SORTS.find(s => s[0] === k) || SORTS[0])[1];
const sortWords = k => sortLabel(k).replace(/^By /, 'by ');

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
// (Nate's "hard to find what you're looking for"). Sort opens a picker, as on Everyone, and says the order in force in the
// picker's own words ("Sort: By topic"). `extra`: the phone's New issue button.
export const toolsHTML = (q, { extra = '' } = {}) => `<div class="i6-tools ig6-tools open" data-istools="is-q">
    <div class="i6-find" id="is-q-find">${icon(ICONS['list-filter'] ? 'list-filter' : 'search')}<input id="is-q" type="search" placeholder="${narrow() ? 'Find an issue' : 'Find an issue or a bill'}" value="${esc(q)}" autocomplete="off" aria-label="Find an issue: a word, a bill number or a bill’s nickname" aria-controls="is-q-body">${iconBtn('x', 'Clear the box', { 'data-istq': 'clear', hidden: !q })}</div>
    ${btn(`Sort: ${esc(sortLabel(sortOf()))}`, { kind: 'secondary', sm: true, iconEnd: 'chevron-down', cls: 'ig6-sortb', attrs: { 'data-igsort': '1', 'aria-haspopup': 'dialog', hidden: !!q.trim() } })}
    ${extra}
  </div>`;
export function pickSort(root, paint) {
  pickerSheet({ title: 'Sort the issues', value: sortOf(), options: SORTS.map(([k, l]) => [k, l]),
    onPick: v => { setSort(v); const s = root.querySelector('[data-igsort] > span'); if (s) s.textContent = `Sort: ${sortLabel(v)}`; paint(); root.querySelector('[data-igsort]')?.focus(); } });
}
