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
// Each card (C-14 on v6; R-352, Nate 27 Oct: "keep the issue cards, but calmer"): the issue's name with its own small icon
// beside it (what tells the issues apart at a glance, Nate's "clearly distinguished"; no coloured band or big tile), how it
// stands in one word with its shape (verbs.js STATES.issue: At risk, On track, Stopped, Won, No bills yet), and its next
// step and date in one line ("HB 1779 needs a hearing by Mon 3/30", "SB 3234 testimony: Writing, due today 9:30 AM, in
// 59 min"). No description on the card (cut short it said little; it is the card's title and leads the issue's page), no
// topic chip (the topic is the heading). At most four facts a card (spec 8). Inside a topic the most urgent issue comes
// first (issuestand.js byUrgency: at risk, then the nearest hearing or deadline).
// The find box is R-272's (issuestand.js searcher: words in any order, bill numbers with or without the space).
import { S, SESSION_OVER, esc } from './data.js';
import { whenAt } from './model.js';
import { icon, iconBtn, btn, pickerSheet } from './ui.js';
import { ICONS } from '../icons.js';
import { plural } from './lists.js';
import { standOf, markOf, hearPart, deadlineGroups, searcher, numNb, byUrgency } from './issuestand.js';
import { nw, shownStatus, billInIssue } from './steps.js';
import { issueKey, stateMark } from './verbs.js';   // R-344 Rule 2: how an issue is doing, as a shape and its word (Decision 4)

// ---- the tints and the icons ----
// Six tints, in the topics' order (tokens in issues.css .ig6-tint1..6, each a wash of one hue with a darker ink of the same
// hue). The cards no longer wear them (R-352); Today's issue line, the bill page's issue card and the issue page still do.
// A topic takes its tint by its place in its list, so a seventh wraps round; null is the neutral wash.
export const TINTS = 6;
export const tintOf = n => n == null ? 'ig6-tint0' : `ig6-tint${(((n % TINTS) + TINTS) % TINTS) + 1}`;
// The apple stays a salad on Staff until Nate picks Food's new icon on R-339's round-2 sheet (bills.js STAFF_TOPIC_IC).
const STAFF_IC = { apple: 'salad' };
export const staffIcon = name => { const n = STAFF_IC[name] || name; return ICONS[n] ? n : ''; };
// The icons the topics wear, as Staff shows them: a coalition whose icon is one of these shows none, so a picture keeps one
// meaning (HEAL's salad is Food's on Staff, CTFH's crossed-out cigarette is Tobacco's).
export const topicIcons = () => new Set((S.categories || []).flatMap(c => [c.icon, staffIcon(c.icon)]).filter(Boolean));
const catOf = k => (S.categories || []).find(c => c.key === k) || null;
// An issue's picture wherever an issue is shown (R-339): its own icon (issues.icon, migration 188; Nate's picks) when that
// name is drawn in ICONS, else its topic's, else the tag.
export const issueIcon = i => staffIcon(i?.icon || '') || staffIcon(catOf(i?.category)?.icon || '') || 'tag';
// The small icon beside a card's name (R-352: no band, no tile, no monogram). Decorative: the name says it.
export const picHTML = ({ ic = '' } = {}) => ic ? `<span class="ig6-ic" aria-hidden="true">${icon(ic)}</span>` : '';

// ---- a card ----
// The whole card is one link (rule 10: focus ring on it, Back puts the focus on it again). `pic`: the small icon (picHTML);
// `foot`: a control that sits on the card outside the link (the Coalitions tab's I help); `after`: a short name after the
// name, small and muted (a coalition's "· CHW"); `lines`: [html, cls], each one line under the name.
export function cardHTML({ key, href, name, after = '', title = '', pic = '', lines = [], foot = '', anchor = '', cls = '' }) {
  return `<div class="ig6-cell${cls ? ' ' + cls : ''}" role="listitem" data-igcard="${esc(key)}"${anchor ? ` id="${esc(anchor)}"` : ''}><div class="ig6-card${foot ? ' has-foot' : ''}">
    <a class="ig6-link" href="${esc(href)}"${title ? ` title="${esc(title)}"` : ''}><span class="ig6-top">${pic}<span class="ig6-name">${esc(name)}${after ? `<span class="ig6-after"> · ${esc(after)}</span>` : ''}</span></span><span class="ig6-lines">${lines.filter(l => l && l[0]).map(([h, c]) => `<span class="${c}">${h}</span>`).join('')}</span></a>
    ${foot ? `<div class="ig6-foot">${foot}</div>` : ''}</div></div>`;
}
export const gridHTML = (inner, label) => `<div class="ig6-grid" role="list" aria-label="${esc(label)}">${inner}</div>`;
// A topic heading's picture (R-352 FIX-3, Nate 28 Oct: "keep ... the colored icons as issue headings"): the topic's icon on
// its own soft tint, one tile a topic, so the six topics read apart as the page scrolls and each heading welcomes you into
// its issues. The cards under it stay calm (their small icon only). A rounded square, never a circle, so it is never taken
// for a person's initials (A-5 on v6: person tints are round). Decorative: the heading says the topic.
export const headTile = (ic, tint = null) => `<span class="ig6-htile ${tintOf(tint)}" aria-hidden="true">${icon(ic || 'tag')}</span>`;
// A group: its heading (22px) with its topic's tile when it has one (g.pic), and its count, a target for its chip; then its grid.
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
  const r = root.querySelector('.ig6-jump .lg6-jrow'); if (!r) return;
  const set = () => { const over = r.scrollWidth > r.clientWidth + 1; r.classList.toggle('ovf', over); r.classList.toggle('atstart', r.scrollLeft <= 1); r.classList.toggle('atend', r.scrollLeft + r.clientWidth >= r.scrollWidth - 1); };
  r.scrollLeft = 0;   // a phone's chip row starts at its first chip
  set(); r.addEventListener('scroll', set, { passive: true });
}
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
const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
const lower = s => s ? s[0].toLowerCase() + s.slice(1) : s;
// A mark's words after its own label ("At risk: HB 1779 needs a hearing by Mon 3/30" -> "HB 1779 needs a hearing by Mon
// 3/30"): the label is the stand line's, so the next-step line does not say it again (A-14). A time's colon ("9:30") is
// never a label's: a label's colon is followed by a space.
const afterLabel = t => String(t || '').replace(/^[^:]+:\s/, '');
// The hearing that leads, as the next step: the testimony's state and its time in status()'s words (steps.js, the one
// wording: "Due today 10:00 AM, in 59 min", "Late, still accepted until 1:10 PM today"); the viewer's own late or overdue
// step keeps its colour (shownStatus), anyone else's is neutral. Due today is plain with a clock and its time in bold.
function hearNext(x) {
  const hp = hearPart(x); if (!hp) return null;
  const s = hp.s, n = billInIssue(x.hear.b, x.i, { max: 16 });   // one name per bill (decision 9): its nickname, as Bills says it, when it fits a small card; else its number
  if (!s?.state) return { text: hp.text };
  const k = s.state.key;
  if (k === 'filed' || k === 'missed') return { text: hp.text };
  // Decision 9: hearPart's text is steps.js statusLine's one text; a small card shortens only the label, "(team cut-off)" to "(team)".
  const sh = shownStatus(s) || {};
  const tone = ['late', 'overdue', 'today'].includes(sh.tone) ? sh.tone : '';
  return { text: hp.text.replace(' (team cut-off)', ' (team)'), tone, ic: tone ? sh.icon || '' : '' };
}
// The card's next step and its date, one line, or none when there is none (stopped, no bills). At risk and a dying bill lead
// (Nate, R-272: "see what issues are at risk of dying"), then the hearing, then the next deadline.
export function nextOf(x) {
  const m = markOf(x);
  if (['risk', 'dying'].includes(x.state) && m) return { text: afterLabel(m.text) };
  const hn = hearNext(x); if (hn) return hn;
  switch (x.state) {
    case 'none': case 'stopped': return null;
    case 'off': return m?.text ? { text: m.text } : null;
    case 'oppose': case 'safe': return m?.text ? { text: cap(afterLabel(m.text)) } : null;
    case 'ahead': return m?.text ? { text: m.text } : null;
  }
  return null;
}
const nextHTML = nx => !nx ? null : [`${nx.ic ? icon(nx.ic) : ''}<span>${nw(esc(nx.text))}</span>`, `ig6-next${nx.tone ? ' t-' + nx.tone : ''}`];

// One issue's card. `why`: the bill a search found it by, said on the next-step line when that line does not name it.
// `tags`: a quiet tag ("Not public yet") said after the stand's word.
function issueCard(x, { tags = [], why = null, anchor = '' } = {}) {
  const { i } = x;
  let nx = nextOf(x);
  // A search that found it by a bill says which, unless the line names that bill already (numbers carry a no-break space).
  const sp = s => String(s || '').replace(/ /g, ' '), nb = why ? numNb(why) : '';
  if (why && !sp(nx?.text).includes(sp(nb)) && !sp(nx?.text).includes(sp(billInIssue(why, x?.i)))) nx = { text: `Found by its bill ${sp(billInIssue(why, x?.i))}` };
  // "Not in the first visit" is a setting of the public first visit (issues.js, 066), not a fact about the issue: it stays on
  // the issue's own page with its switch (R-344 D10).
  const shown = tags.filter(t => !/first visit/i.test(t));
  // How the issue stands: its shape and its word, neutral, no tint (R-344 Decision 4; A-5: never colour alone).
  const stand = `${stateMark('issue', issueKey(x), { size: 18, cls: 'ig6-sic' })}${shown.length ? `<span class="ig6-tag"> · ${esc(shown.join(', '))}</span>` : ''}`;
  return cardHTML({ key: i.id, href: '#/issue/' + encodeURIComponent(i.id), name: i.name, title: i.description || '', anchor, cls: 'ig6-issue',
    pic: picHTML({ ic: issueIcon(i) }),   // the issue's own icon (Nate's R-339 picks), else its topic's
    lines: [[stand, 'ig6-stat'], nextHTML(nx)] });
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

// By topic: the most urgent first inside each topic (R-352, Nate 27 Oct): at risk, then the nearest hearing or deadline, then
// the rest by name (issuestand.js byUrgency); the topics stay the grouping (spec 2, R-272).
// The issues with nothing moving (every bill stopped, or none this session) wait in a fold at the end of their topic, as By
// next deadline folds them: details wait until asked for (V6-SPEC), and the topic leads with what can still move.
const urgent = (a, b) => byUrgency(a, b) || byName(a, b);
const quiet = x => ['stopped', 'none'].includes(x.state) && issueKey(x) !== 'won';
function topicBody(c, l, o) {
  const live = l.filter(x => !quiet(x)), rest = l.filter(quiet), card = x => issueCard(x, { tags: o.tagsOf(x) });
  return `${live.length ? gridHTML(live.map(card).join(''), c.name) : ''}${rest.length ? `<details class="i6-fold ig6-fold ig6-rest" data-fold="ig6-r-${esc(c.key)}"><summary>${icon('chevron-down', { cls: 'i6-chev' })}<span>Not moving this session (${rest.length})</span></summary>${gridHTML(rest.map(card).join(''), `${c.name}: not moving this session`)}</details>` : ''}`;
}
function topicGroups(list, o) {
  return (S.categories || []).map((c, k) => { const l = list.filter(x => x.i.category === c.key).sort(urgent); if (!l.length) return null;
    return { id: `ig6-g-${c.key}`, title: c.name, chip: c.name, n: l.length, count: countWords(l), pic: headTile(staffIcon(c.icon) || 'tag', k), body: topicBody(c, l, o) }; }).filter(Boolean)
    // An issue whose topic is not one of the six (a new key) still shows, last, rather than vanishing.
    .concat((() => { const keys = new Set((S.categories || []).map(c => c.key)), l = list.filter(x => !keys.has(x.i.category)).sort(urgent);
      return l.length ? [{ id: 'ig6-g-other', title: 'No topic yet', chip: 'No topic', n: l.length, count: plural(l.length, 'issue'), pic: headTile('tag'), body: topicBody({ key: 'other', name: 'No topic yet' }, l, o) }] : []; })());
}
function letterGroups(list, o) {
  const by = new Map();
  for (const x of list.slice().sort(byName)) { const k = (x.i.name.normalize('NFD').replace(/[^\p{L}\p{N}]/gu, '')[0] || '#').toUpperCase(); if (!by.has(k)) by.set(k, []); by.get(k).push(x); }
  return [...by].map(([k, l]) => ({ id: `ig6-l-${/[A-Z0-9]/.test(k) ? k : 'x'}`, title: k, chip: k, flow: true,
    inner: l.map((x, n) => issueCard(x, { tags: o.tagsOf(x), anchor: n ? '' : `ig6-l-${/[A-Z0-9]/.test(k) ? k : 'x'}` })).join('') }));
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
