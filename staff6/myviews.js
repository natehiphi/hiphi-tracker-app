// My issues' views (R-336 walk 3, Nate 25 Oct, from twelve mockups drawn on the practice copy; walk 4 the same day). His goal
// for an issue: "The goal is to get one of the bills through and having as many options as possible is key, but having at
// least one per chamber is ideal, no more than that is necessary. Being able to understand that along with what to do next
// in a quick glance is crucial." His picks:
//   Deadlines (the default, walk 4: "I've changed my mind about sorting by number of chambers that are alive. Issues should
//     be sorted by needed deadline, and it should be easy to tell from there whether there is another bill in the other
//     chamber that is alive or not"): one quiet line of counts, Needs you today, then a heading a deadline in date order
//     ("Must clear Second lateral · Mon 3/30 · in 14 days · 14 issues"), each issue under the deadline it must beat next
//     with its next step and walk 3's House | Senate cells, read against the heading. Stopped issues last, folded.
//   Status (mockups 7 and 8 together): Needs you · On track · Stopped, each row saying Cleared, At risk or Not yet.
//   Topics (mockup 9): shelves by topic, each headed by its icon on its soft tint, with jump chips.
//   Spreadsheet (mockup 12): one row per issue, sortable headers, Copy for Google Sheets (as Bills' spreadsheet).
// R-352 part 4 (Nate 27 Oct, "keep the cards, calmer"; A-14, A-18, C-14 on v6): each issue is said once (those due today
// stand under "Needs you today" and nowhere below); no "Needs you" chip (it was on 25 of 26 cards); each cell says one
// short thing ("House: hearing today"); no counts line; one small icon beside the name on the Deadlines and Status rows.
// R-352 FIX-3 (Nate 28 Oct, "Yes, but keep the topics and spreadsheet tabs"): Topics and Spreadsheet are back beside
// Deadlines and Status, four views as on live; a saved "topics" or "sheet" opens them again, walk 3's "cover" opens Deadlines.
// The switch is remembered for the person (prefs.myIssuesView, with this browser's copy for a first paint), as Bills'
// Rows | Spreadsheet is (bills.js setMode).
//
// THE WORDS, defined once here (said on the page where they are used):
//   Started in the House / Senate  the chamber a bill STARTED in (HB or SB, and HCR / SCR), not where it is now: by mid-March
//                               every live bill has crossed over, so each bill also says where it is now ("now in Senate
//                               Education"), as the issue page does (one wording with it, the coordinator's note).
//   Alive in both chambers      a House bill and a Senate bill on HIPHI's side are still moving: two chances.
//   HIPHI's side                issuestand.js's rule: no Monitor and none HIPHI opposes (unless nothing else is on it).
//   The next deadline (D)       the soonest Capitol deadline any of the issue's bills on HIPHI's side is still racing
//                               (stops.js billStop's deadline; issuestand.js standOf's own `deadline`).
//   Past it / cleared           a bill racing a LATER deadline than D already cleared D (stops.js: a bill's deadline only
//                               moves on once it is through), and one on the Governor's desk or law is past every one.
//   Cleared                     an issue with a bill already past its next deadline: it survives that deadline whatever
//                               else happens.
//   At risk                     issuestand.js's meaning: no bill on it is past its next deadline yet, the deadline is 14
//                               days away or less (model.js RADAR_DAYS), and no bill racing it has a hearing set or held:
//                               if none gets one, the issue stops.
//   Not yet                     no bill past it yet, but a hearing is set or held, or the deadline is further off.
//   Needs you                   testimony on its leading hearing not yet filed and due (or the hearing) within 7 days, or
//                               At risk. "Needs you today": those due within 24 hours. On track: every other live issue,
//                               so always Cleared or Not yet. Stopped: no bill on HIPHI's side still moving, or none.
// Nothing here is amber or red: a step of the viewer's own that is late keeps its colour from steps.js (shownStatus), and
// "At risk" is a word and an icon (D3, A-5). Calm budgets (staff6_budget.py): names at 500, numbers at 500, labels 14px.
import { S, DB, DEMO, esc } from './data.js';
import { stopOf, hearingAhead, gateHead, gateGloss, whenAt, RADAR_DAYS } from './model.js';
import { icon, iconBtn, toast } from './ui.js';
import { plural } from './lists.js';
import { numWords, dayWords, committeeName, nw } from './steps.js';
import { hearPart, markOf, byUrgency, rowOf, searchHTML, FEW } from './issuestand.js';
import { ICONS } from '../icons.js';
import { issueIcon } from './issuegrid.js';

const AGAINST = new Set(['strongly_oppose', 'oppose']);
const THROUGH = new Set(['governor', 'law', 'ballot']);
const CH = { H: 'House', S: 'Senate' };
const HBSB = { H: 'HB', S: 'SB' };   // the cell's heading: the chamber a bill STARTED in, never read as where the hearing is (R-356 round 3, C-15)
const WEEK = 7 * 864e5;
const origin = b => /^S/.test(String(b.bill_number || '')) ? 'S' : 'H';
const num = b => numWords(b).replace(' ', ' ');
const names = l => l.length > 2 ? plural(l.length, 'bill') : l.map(num).join(' and ');
const endOf = date => new Date(date + 'T23:59:59-10:00').getTime();
const daysTo = date => Math.floor((endOf(date) - Date.now()) / 864e5);
const href = i => `#/issue/${encodeURIComponent(i.id)}?from=mine`;
// A deadline by its day for everyone ("past the Mon 3/30 deadline"), under a heading that says what it asks (model.js
// gateHead; R-352 FIX-2: one name for one deadline, the Capitol's only in the chair email and Help; C-15 on v6).
const dn = D => `the ${dayWords(D.date)} deadline`;
const dayTail = () => '';
// What a deadline asks, in the app's one set of words (model.js gateGloss, the same as Help and Today's season card):
// under each Deadlines column, and as the title of a line that names a deadline.
export const glossOf = D => { const g = D ? gateGloss(D.label) : ''; return g ? g[0].toUpperCase() + g.slice(1) : ''; };

// ---- one issue, judged for these views ----
// x: issuestand.js standOf(i) with `own`. Returns what every view draws from, so they all say the same thing.
export function judge(x) {
  const { i, going = [], gone = [] } = x;
  let side = going.filter(b => b.position && b.position !== 'monitor' && !AGAINST.has(b.position));
  if (!side.length) side = going.filter(b => !AGAINST.has(b.position));
  const oppose = i.stance === 'oppose';
  if (oppose) side = going;
  const st = new Map(side.map(b => [b.id, stopOf(b)]));
  const dlOf = b => { const s = st.get(b.id); return s?.deadline && !s.deadline.missed ? s.deadline : null; };
  const D = (oppose ? x.next : x.deadline) || side.map(dlOf).filter(Boolean).sort((a, b) => a.date.localeCompare(b.date))[0] || null;
  const bills = side.map(b => { const s = st.get(b.id), d = dlOf(b);
    return { b, st: s, ch: origin(b), dl: d, past: D ? (d ? d.date > D.date : THROUGH.has(s.phase)) : THROUGH.has(s.phase) }; });
  const H = bills.filter(y => y.ch === 'H'), Sn = bills.filter(y => y.ch === 'S');
  const goneOf = c => gone.filter(b => origin(b) === c && b.tracked !== false);   // the Spreadsheet's "none · 2 stopped"
  const alive = !['stopped', 'none', 'off'].includes(x.state) && bills.length > 0;
  const kind = !alive ? 'stopped' : oppose ? 'oppose' : H.length && Sn.length ? 'both' : 'one';
  const cleared = bills.filter(y => y.past);
  // At risk keeps issuestand.js's meaning (the critic): no bill past D, D two weeks away or less (RADAR_DAYS), and no bill
  // racing D has a hearing set or held (each still in the board's "needs a hearing" column). A hearing set: Not yet.
  const racing = D ? bills.filter(y => y.dl?.date === D.date) : [];
  const noHearing = racing.length > 0 && racing.every(y => y.st.column === 'a' && !hearingAhead(y.b));
  const dstate = !alive || oppose ? '' : !D ? (cleared.length ? 'cleared' : '') : cleared.length ? 'cleared' : daysTo(D.date) <= RADAR_DAYS && noHearing ? 'risk' : 'notyet';
  // Bills that must still get a hearing for D, in a chamber with no bill past D yet: someone has to ask a chair.
  const chPast = c => bills.some(y => y.ch === c && y.past);
  const ask = !alive || oppose || !D ? [] : bills.filter(y => !y.past && y.dl?.date === D.date && y.st.column === 'a' && !hearingAhead(y.b) && !chPast(y.ch));
  const hp = hearPart(x);   // its words are steps.js statusLine's (issuestand.js hearPart, decision 9)
  const open = hp && hp.s && !['filed', 'missed'].includes(hp.s.state?.key);
  // The testimony's own due time when it has one (a Monday hearing's testimony is due the day before), else the hearing.
  const soon = !!(x.hear && new Date(hp?.s?.due ?? x.hear.h.scheduled_at) - Date.now() <= WEEK);
  const needs = alive && !oppose && ((open && soon) || dstate === 'risk');
  // When it is due, for "Needs you today": the testimony's due time (late: now), else the end of an At risk deadline's day.
  const dueAt = !needs ? null : open && soon ? (hp.late ? Date.now() : new Date(hp.s.due ?? x.hear.h.scheduled_at).getTime()) : endOf(D.date);
  const j = { x, i, own: x.own, D, bills, H, S: Sn, goneH: goneOf('H'), goneS: goneOf('S'), alive, kind, cleared, dstate, ask, hp, needs, dueAt };
  j.health = healthOf(j); j.next = nextOf(j); j.dline = deadlineLine(j);
  if (D) { j.health.title = glossOf(D); if (j.dline) j.dline.title = glossOf(D); }
  return j;
}

// ---- the words ----
// The one-sentence health check (mockup 6), with the deadline in it: a split chamber reads as a split.
function healthOf(j) {
  const { kind, D, H, S: Sn, x } = j;
  if (kind === 'stopped') return { ic: 'circle-minus', text: markOf(x)?.text || 'Nothing moving this session' };
  if (kind === 'oppose') return { ic: 'circle-x', text: markOf(x)?.text || 'HIPHI opposes it: its bills are still moving' };
  const one = (c, l) => l.length === 1 ? `a ${CH[c]} bill is` : `${CH[c]} bills are`;
  if (kind === 'both') {
    if (!D) return { ic: 'circle-check', tone: 'done', text: 'Alive in both chambers: two chances' };
    const hc = H.some(y => y.past), sc = Sn.some(y => y.past);
    if (hc && sc) return { ic: 'circle-check', tone: 'done', text: `Past ${dn(D)} in both chambers` };
    if (hc || sc) { const [a, b] = hc ? ['H', 'S'] : ['S', 'H'], la = hc ? H : Sn, lb = hc ? Sn : H;
      return { ic: 'scale', text: `Split: ${la.length === 1 ? `the ${CH[a]} bill is` : `a ${CH[a]} bill is`} past ${dn(D)}, ${lb.length === 1 ? `the ${CH[b]} bill is` : `no ${CH[b]} bill is`} not yet` }; }
    return { ic: 'clock', text: `Two chances, neither past ${dn(D)} yet${dayTail(D)}` };
  }
  const c = H.length ? 'H' : 'S', l = H.length ? H : Sn;
  if (!D) return { ic: 'circle-dot', text: `Only ${one(c, l)} alive` };
  return l.some(y => y.past) ? { ic: 'circle-dot', text: `Only ${one(c, l)} alive, and ${l.length === 1 ? 'it is' : 'one is'} past ${dn(D)}` }
    : { ic: 'circle-dot', text: `Only ${one(c, l)} alive, not past ${dn(D)} yet${dayTail(D)}` };
}
// The next step: the testimony on the leading hearing in steps.js's words (issuestand.js hearPart), else the hearing a
// bill still needs, else nothing to do yet.
function nextOf(j) {
  const { hp, ask, D, kind, x } = j;
  if (kind === 'stopped') return null;
  if (hp) return { ic: hp.ic, html: hp.tone ? `<span class="i6-p1 t-${hp.tone}">${hp.html}</span>` : hp.html, text: hp.text, tone: hp.tone, you: !!(hp.you && (hp.soon || hp.late || hp.tone)) };
  if (ask.length) { const t = `Get ${names(ask.map(y => y.b))} a hearing by ${dayWords(D.date)}`; return { ic: 'calendar-plus', html: nw(esc(t)), text: t, ask: `${names(ask.map(y => y.b))} a hearing` }; }
  if (kind === 'oppose') return null;
  const later = j.bills.map(y => y.dl).filter(d => d && (!D || d.date > D.date || j.dstate !== 'cleared')).sort((a, b) => a.date.localeCompare(b.date))[0] || D;
  const t = later ? `Nothing to do yet: next deadline ${dayWords(later.date)}` : 'Nothing to do yet';
  return { ic: 'eye', html: nw(esc(t)), text: t, quiet: true, at: later?.date || null };
}
// Cleared / At risk / Not yet for the next deadline, with the reason (mockup 8).
function deadlineLine(j) {
  const { dstate, D, cleared, bills } = j;
  if (!dstate) return null;
  if (dstate === 'cleared') return { ic: 'circle-check', tone: 'done', word: 'Cleared', text: D ? `Cleared: ${names(cleared.map(y => y.b))} ${cleared.length === 1 ? 'is' : 'are'} past ${dn(D)}` : 'Cleared: through its committees' };
  const racing = bills.filter(y => y.dl?.date === D.date), set = racing.filter(y => y.st.hearingState === 'scheduled' || y.st.hearingState === 'held');
  const why = set.length ? `${names(set.map(y => y.b))} ${set.length === 1 ? 'has' : 'have'} a hearing` : racing.some(y => y.st.column === 'a') ? `${names(racing.filter(y => y.st.column === 'a').map(y => y.b))} ${racing.length === 1 ? 'needs' : 'need'} a hearing` : 'waiting for a floor vote';
  return dstate === 'risk' ? { ic: 'triangle-alert', word: 'At risk', text: `At risk: no bill past ${dn(D)} yet${dayTail(D)}; ${why}` }
    : { ic: 'clock', word: 'Not yet', text: `Not yet: no bill past ${dn(D)}${dayTail(D)}; ${why}` };
}
// Where a bill is now, in words (C-15: committees by name, never a code): the Spreadsheet's chamber columns.
function whereNow(st) {
  if (st.phase === 'committee') return st.committee ? `now in ${committeeName(st.committee)}` : `waiting for a ${CH[st.chamber]} committee`;
  if (st.phase === 'floor') return `on the ${CH[st.chamber]} floor`;
  if (st.phase === 'conference') return 'in conference';
  if (st.phase === 'governor') return 'on the Governor’s desk';
  if (st.phase === 'law') return 'law';
  return '';
}
const lineSpan = (p, cls = 'mi-ln') => p ? `<span class="${cls}${p.tone ? ' t-' + p.tone : ''}${p.quiet ? ' q' : ''}"${p.title ? ` title="${esc(p.title)}"` : ''}>${p.ic && ICONS[p.ic] ? icon(p.ic) : ''}<span>${p.html || nw(esc(p.text))}</span></span>` : '';
const tagsOf = j => [j.own ? '' : 'You help', !j.needs && j.next?.you ? 'Your step' : ''].filter(Boolean);
// No "Needs you" chip (R-352, A-14): it stood on 25 of Nate's 26 cards, so it told nothing; the section an issue stands in
// and its step line say it. The small grey tags stay ("You help", "Your step").
const tagHTML = j => tagsOf(j).map(t => `<span class="mi-tag">${esc(t)}</span>`).join('');
// The issue's own icon, else its topic's (issuegrid.js issueIcon, R-339): one small drawing in the topic's ink beside the
// name, no tile (R-352, A-18 on v6). Topics' shelves keep their headings' tinted tiles (FIX-3: the topic is what they sort by).
const topicIc = i => `<span class="mi-ic mi-c-${esc(i.category || 'none')}" aria-hidden="true">${icon(issueIcon(i))}</span>`;

// ---- the switch (remembered for the person) ----
// Four views (R-352 FIX-3, Nate 28 Oct): Deadlines (the default), Status, Topics and Spreadsheet, as words (no tab icons,
// A-18 on v6). A saved walk 3 "cover" opens Deadlines (OLD); any other value not in VIEWS does too.
export const VIEWS = [['deadlines', 'Deadlines'], ['status', 'Status'], ['topics', 'Topics'], ['sheet', 'Spreadsheet']];
const OLD = { cover: 'deadlines' };
const VKEY = () => `hiphi6_miview_${S.me?.id || ''}${DEMO ? '_demo' : ''}`;
export function viewNow() {
  const who = S.me?.id || '', st = (S.miView ??= {});
  if (st.for !== who) { let m = S.me?.prefs?.myIssuesView; if (!m) { try { m = localStorage.getItem(VKEY()); } catch { m = null; } }
    m = OLD[m] || m; st.v = VIEWS.some(([k]) => k === m) ? m : 'deadlines'; st.for = who; }
  return st.v;
}
export function setViewNow(m) {
  viewNow(); const st = S.miView; if (st.v === m || !VIEWS.some(([k]) => k === m)) return;
  st.v = m;
  try { localStorage.setItem(VKEY(), m); } catch { /* this visit only */ }
  if (S.me) S.me.prefs = { ...(S.me.prefs || {}), myIssuesView: m };
  DB.patchPrefs?.({ myIssuesView: m })?.catch?.(() => { /* kept in this browser */ });
}
// The filter box (issuestand.js's, wired by its wireTools) and the four-button switch, on a phone too (its own row there,
// css/myissues.css; no tab icons, A-18 on v6). A short list (under 6 issues) needs no filter, but keeps the switch.
export function toolsHTML(q, count) {
  const v = viewNow(), filter = count >= FEW || q;
  const FI = ICONS['list-filter'] ? 'list-filter' : 'sliders-horizontal';
  return `<div class="i6-tools mi-tools${q ? ' open' : ''}" data-istools="mi-q">
    ${filter ? `${iconBtn(FI, 'Filter your issues', { 'data-istq': 'open', 'aria-expanded': String(!!q), 'aria-controls': 'mi-q-find' }, 'i6-findbtn')}
    <div class="i6-find" id="mi-q-find">${icon(FI)}<input id="mi-q" type="search" placeholder="Filter your issues" value="${esc(q)}" autocomplete="off" aria-label="Filter your issues: a word, a bill number or a bill’s nickname" aria-controls="mi-q-body">${iconBtn('x', 'Clear the filter', { 'data-istq': 'clear', hidden: !q })}</div>` : ''}
    <div class="sv-seg mi-seg" role="group" aria-label="Show your issues as">${VIEWS.map(([k, l]) => `<button type="button" data-miview="${k}" aria-pressed="${v === k}">${l}</button>`).join('')}</div>
  </div>`;
}

// ---- the body for the view in force ----
export function bodyHTML(list, { q = '', opts = {} } = {}) {
  if (q.trim()) return searchHTML(list, q, opts);
  const js = list.map(judge);
  switch (viewNow()) {
    case 'status': return statusHTML(js, opts);
    case 'topics': return topicsHTML(js);
    case 'sheet': return sheetHTML(js);
    default: return deadlinesHTML(js, opts);
  }
}
const sortUrgent = l => [...l].sort((a, b) => (a.needs ? 0 : 1) - (b.needs ? 0 : 1) || byUrgency(a.x, b.x));
const stoppedFold = (l, opts, title) => l.length ? `<details class="i6-fold mi-stopped" id="mi-g-stopped" data-fold="mi-stopped"><summary>${icon('chevron-down', { cls: 'i6-chev' })}<span>${esc(title)}</span></summary>
  <div class="v6-list i6-list" role="list">${l.map(j => rowOf(j.x, { from: 'mine', tags: opts.tagsOf ? opts.tagsOf(j.x) : [] })).join('')}</div></details>` : '';

// ---- Deadlines (the default, R-336 walk 4) ----
// Nate, walk 4: "Issues should be sorted by needed deadline, and it should be easy to tell from there whether there is
// another bill in the other chamber that is alive or not." So the issues stand under the deadline each must beat next (D,
// issuestand.js standOf's own `deadline`: the one place that rule lives), one heading a deadline in date order, and each
// row keeps the two chamber cells, read against its heading.
// A bill's state in a few words for a cell, without the deadline (the heading says it once).
function billShort(y) {
  const { st } = y;
  if (st.phase === 'law') return 'law';
  if (st.phase === 'governor' || st.phase === 'ballot') return 'passed the Legislature';
  if (st.phase === 'committee') {
    if (st.hearingState === 'scheduled') { const w = whenAt(st.hearing.scheduled_at).split(' ')[0]; return `hearing ${/^(today|tomorrow)$/.test(w) ? w : dayWords(st.hearing.scheduled_at)}`; }
    if (st.hearingState === 'held') return 'heard, vote next';
    if (st.hearingState === 'decided') return /passed/.test(st.decided || '') ? 'passed a committee' : 'decided';
    return 'needs a hearing';
  }
  if (st.phase === 'floor') return 'needs a floor vote';
  if (st.phase === 'conference') return 'in conference';
  return 'moving';
}
// Where the bill is now, once it has left the chamber it started in ("now in the Senate"): only in the cell's title now,
// with its number (R-352: a cell says one short thing; the issue page names the bills and their committees).
function whereLine(y, c) {
  const { st } = y;
  if (st.phase === 'committee' || st.phase === 'floor') return st.chamber && st.chamber !== c ? `now in the ${CH[st.chamber]}` : '';
  return st.phase === 'conference' ? 'being settled by both chambers' : st.phase === 'governor' ? 'on the Governor’s desk' : '';
}
// A cell (R-352, Nate 27 Oct): a small glyph and one short thing in plain words, "HB: hearing today", "SB: cleared",
// "No SB alive". The chamber is where the bill STARTED (HB / SB). The glyph: a tick on green when a bill from that
// chamber cleared the heading's deadline, a teal dot when one is alive, a grey ring when none is; the words say the same
// (A-5: never colour alone). The furthest-along bill speaks for the chamber; the title names the bills.
function cellHTML(j, c) {
  const l = c === 'H' ? j.H : j.S, st = !l.length ? 'no' : l.some(y => y.past) ? 'ok' : 'on';
  const y = [...l].sort((a, b) => (b.past ? 1 : 0) - (a.past ? 1 : 0))[0];
  const words = !y ? `No ${HBSB[c]} alive` : j.D && y.past ? 'cleared' : billShort(y);
  const title = l.map(b => [num(b.b), whereLine(b, c)].filter(Boolean).join(', ')).join('; ');
  return `<div class="mi-cell ${st}" data-cell="${c}"${title ? ` title="${esc(title)}"` : ''}><span class="mi-gl ${st}" aria-hidden="true">${st === 'ok' ? icon('check') : ''}</span><span class="mi-cl">${y ? `<span class="mi-chn" title="${c === 'H' ? 'House-started bills (HB)' : 'Senate-started bills (SB)'}">${HBSB[c]}:</span> ${esc(words)}` : `<span class="mi-chn" title="${c === 'H' ? 'House-started bills (HB)' : 'Senate-started bills (SB)'}">${esc(words)}</span>`}</span></div>`;
}
// A row: the name with its small icon and tags, the next step, and the two cells. No health sentence here: the heading
// says the deadline and the cells say each chamber, so a third line would only repeat them (C-14 on v6: fewer lines).
// Under a heading the step drops the heading's own date ("Get HB 1880 a hearing", "Nothing to do yet"): the deadline is
// put in words once (the critic). At risk (issuestand.js's meaning, judge's dstate) leads the step line in a word and its
// icon, never colour alone (D3, A-5).
function stepUnder(j, under) {
  const nx = j.next; if (!nx) return null;
  if (nx.quiet && under && nx.at === under) return { ...nx, html: '', text: 'Nothing to do yet' };
  if (!nx.ask) return nx;
  const t = `${j.dstate === 'risk' ? 'At risk: get' : 'Get'} ${nx.ask}${under ? '' : ` by ${dayWords(j.D.date)}`}`;
  return { ...nx, ic: j.dstate === 'risk' ? 'triangle-alert' : nx.ic, html: nw(esc(t)), text: t };
}
function covItem(j, under) {
  return `<a class="mi-cov" href="${href(j.i)}" data-mirow="${esc(j.i.id)}">
    <span class="mi-cvt"><span class="mi-name">${topicIc(j.i)}<span class="mi-nm">${esc(j.i.name)}</span>${tagHTML(j)}</span>${lineSpan(stepUnder(j, under) || j.health)}</span>
    <span class="mi-cells">${cellHTML(j, 'H')}${cellHTML(j, 'S')}</span></a>`;
}
// Inside a heading: what needs your hand first, soonest due first (testimony due, then an At risk deadline: dueAt), because
// that is what someone opening the page came to do; then the issues not past the deadline yet (they can still die on it),
// then the cleared ones (safe whatever happens on that day); then by name, so a long heading stays findable and steady.
const RANK = j => j.needs ? 0 : j.dstate === 'cleared' ? 2 : 1;
const inHeading = l => [...l].sort((a, b) => RANK(a) - RANK(b) || (a.needs ? a.dueAt - b.dueAt : 0) || a.i.name.localeCompare(b.i.name));
const meta = (bits) => `<span class="mi-dhm"><span class="mi-dhd" aria-hidden="true">· </span>${esc(bits.filter(Boolean).join(' · '))}</span>`;
// The heading says what the deadline asks with its day, as Who to ask does ("Must reach their last committee by Mon 3/30",
// model.js gateHead; R-352 FIX-2), then how far off and how many issues, quiet. The plain-words second line went: the
// heading says it now (A-14).
function deadlineSec(D, l, k) {
  const id = `mi-d-${k}`, days = Math.max(0, daysTo(D.date));
  const t = gateHead(D.label, dayWords(D.date));
  return `<section class="i6-sec mi-grp mi-dsec" id="${id}" data-dl="${esc(D.date)}" aria-labelledby="${id}-h"><h2 class="i6-h mi-dh" id="${id}-h">${esc(t)} ${meta([days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`, plural(l.length, 'issue')])}</h2>
    <div class="mi-card">${inHeading(l).map(j => covItem(j, D.date)).join('')}</div></section>`;
}
const plainSec = (id, t, sub, l) => l.length ? `<section class="i6-sec mi-grp" id="mi-g-${id}" aria-labelledby="mi-gh-${id}"><h2 class="i6-h" id="mi-gh-${id}">${esc(t)} ${meta([plural(l.length, 'issue')])}</h2>${sub ? `<p class="mi-sub">${esc(sub)}</p>` : ''}
    <div class="mi-card">${inHeading(l).map(j => covItem(j, null)).join('')}</div></section>` : '';
// "Needs you today" (Nate's walk-4 pick): what is due within 24 hours, soonest first, as the same cards (cells and all), and
// those issues are not drawn again under their deadline (A-14, R-352). Moving the whole card here, rather than a strip of
// one-line rows that only point down the page, is the calmer of the two: one place for each issue, nothing to match up, and
// what is due today is complete where it is first seen. A deadline left with no issue below loses its heading.
const DAY = 864e5;
const dueToday = j => j.needs && j.dueAt != null && j.dueAt - Date.now() <= DAY;
function deadlinesHTML(js, opts) {
  const live = js.filter(j => j.alive && j.kind !== 'oppose'), opp = js.filter(j => j.kind === 'oppose');
  const stop = js.filter(j => j.kind === 'stopped').sort((a, b) => a.i.name.localeCompare(b.i.name));
  const today = live.filter(dueToday).sort((a, b) => a.dueAt - b.dueAt), later = live.filter(j => !dueToday(j));
  const byDate = new Map();
  for (const j of later.filter(j => j.D)) { const g = byDate.get(j.D.date) || { D: j.D, l: [] }; g.l.push(j); byDate.set(j.D.date, g); }
  const groups = [...byDate.values()].sort((a, b) => a.D.date.localeCompare(b.D.date));
  const rest = later.filter(j => !j.D);
  // No counts line on top (R-352: "4 alive in both chambers · 19 in one" was jargon, and each heading and the Stopped fold
  // already count their own issues: A-14).
  const none = stop.filter(j => j.x.state === 'none').length;
  const foldTitle = none ? `${stop.length} stopped or with no bill yet` : `${stop.length} stopped this session`;
  return `${today.length ? `<section class="i6-sec mi-grp mi-today" id="mi-g-today" aria-labelledby="mi-today-h"><h2 class="i6-h" id="mi-today-h">Needs you today ${meta([plural(today.length, 'issue')])}</h2>
      <div class="mi-card">${today.map(j => covItem(j, null)).join('')}</div></section>` : ''}
    ${groups.map((g, k) => deadlineSec(g.D, g.l, k)).join('')}
    ${plainSec('rest', 'No committee deadline ahead', 'Through their committees: floor votes, conference or the Governor next.', rest)}
    ${plainSec('opp', 'HIPHI opposes', 'Here HIPHI wants the bills to stop.', opp)}
    ${!live.length && !opp.length ? `<p class="i6-quiet">None of your issues has a bill moving now.</p>` : ''}
    ${stoppedFold(stop, opts, foldTitle)}`;
}

// ---- Status: Needs you · On track · Stopped, each with Cleared / At risk / Not yet ----
function statusRow(j) {
  return `<div class="v6-row i6-row mi-srow" role="listitem" data-v6row="${esc(j.i.id)}"><a class="v6-row-main" href="${href(j.i)}" data-mirow="${esc(j.i.id)}"><span class="v6-row-top"><span class="v6-row-name">${topicIc(j.i)}${esc(j.i.name)}</span>${tagsOf(j).length ? ` <span class="v6-row-num">${esc(tagsOf(j).join(', '))}</span>` : ''}</span>
    ${lineSpan(j.next || j.health, 'v6-row-line')}${j.dline ? lineSpan(j.dline, 'v6-row-line mi-dl') : ''}</a></div>`;
}
function statusHTML(js, opts) {
  const need = sortUrgent(js.filter(j => j.needs)), ok = sortUrgent(js.filter(j => j.alive && !j.needs)), stop = js.filter(j => !j.alive).sort((a, b) => a.i.name.localeCompare(b.i.name));
  const sec = (id, t, sub, l, empty) => `<section class="i6-sec mi-ssec" aria-labelledby="mi-s-${id}"><h2 class="i6-h" id="mi-s-${id}">${esc(t)}</h2><p class="mi-sub">${esc(sub)}</p>
    ${l.length ? `<div class="v6-list i6-list" role="list">${l.map(statusRow).join('')}</div>` : `<p class="i6-quiet">${esc(empty)}</p>`}</section>`;
  return `<p class="mi-def">Cleared: a bill on it is already past its next deadline. At risk: none is yet, the deadline is two weeks away or less, and no bill racing it has a hearing set. Not yet: none is past it, but a hearing is set or there is more time.</p>
    <div class="mi-status">
      ${sec('need', 'Needs you', `${plural(need.length, 'issue')}: testimony due this week, or at risk`, need, 'Nothing on your issues needs you this week.')}
      <div class="mi-sside">${sec('ok', 'On track', `${plural(ok.length, 'issue')}: cleared, a hearing set, or more time`, ok, 'No other issue is moving.')}
      ${stop.length ? `<section class="i6-sec mi-ssec"><h2 class="i6-h">Stopped</h2><p class="mi-sub">${esc(plural(stop.length, 'issue'))}: nothing moving this session</p>${stoppedFold(stop, opts, 'Show them')}</section>` : ''}</div>
    </div>`;
}

// ---- Topics: shelves by topic, each headed by its icon on its soft tint (mockup 9) ----
// The shelf heading carries the topic's tile (it is what this view sorts by); the cards stay calm: the issue's small
// drawing beside its name, its tags and one line, no tinted band (R-352, A-18 on v6). Which chambers are alive is said in
// words under the line, as the Deadlines cells say it ("Both chambers", "One chamber").
const KIND = { both: 'Alive in both chambers', one: 'Alive in one chamber', oppose: 'HIPHI opposes', stopped: 'Stopped' };
function topicsHTML(js) {
  const cats = (S.categories || []).map(c => ({ c, l: js.filter(j => j.i.category === c.key) })).filter(g => g.l.length);
  const other = js.filter(j => !cats.some(g => g.c.key === j.i.category));
  if (other.length) cats.push({ c: { key: 'none', name: 'Other', icon: 'tag' }, l: other });
  const card = j => `<a class="mi-tcard${j.alive ? '' : ' off'}" href="${href(j.i)}" data-mirow="${esc(j.i.id)}">
    <span class="mi-name">${topicIc(j.i)}<span class="mi-nm">${esc(j.i.name)}</span>${tagHTML(j)}</span>${lineSpan(j.alive ? j.next || j.health : j.health)}<span class="mi-kind">${esc(KIND[j.kind] || '')}</span></a>`;
  return `${cats.length > 1 ? `<div class="mi-jump" role="group" aria-label="Jump to a topic">${cats.map(g => `<button type="button" data-mijump="${esc(g.c.key)}"><span class="mi-jic mi-c-${esc(g.c.key)}" aria-hidden="true">${icon(g.c.icon || 'tag')}</span>${esc(g.c.name)} <span class="mi-q">${g.l.length}</span></button>`).join('')}</div>` : ''}
    ${cats.map(g => { const live = g.l.filter(j => j.alive).length, l = [...g.l].sort((a, b) => (a.alive ? 0 : 1) - (b.alive ? 0 : 1) || byUrgency(a.x, b.x));
      return `<section class="i6-sec mi-shelf" id="mi-t-${esc(g.c.key)}" aria-labelledby="mi-th-${esc(g.c.key)}"><div class="mi-shead"><span class="mi-sic mi-c-${esc(g.c.key)}" aria-hidden="true">${icon(g.c.icon || 'tag')}</span>
        <div><h2 class="i6-h" id="mi-th-${esc(g.c.key)}">${esc(g.c.name)}</h2><p class="mi-sub">${esc(`${plural(g.l.length, 'issue')} · ${live} still alive`)}</p></div></div>
        <div class="mi-tgrid">${l.map(card).join('')}</div></section>`; }).join('')}`;
}

// ---- Spreadsheet: one row per issue, sortable, Copy for Google Sheets (mockup 12) ----
const ownerName = i => i.owner_id && i.owner_id === S.me?.id ? 'You' : (S.advocates || []).find(a => a.id === i.owner_id)?.full_name || 'No owner yet';
const DSTATE = { cleared: 'Cleared', risk: 'At risk', notyet: 'Not yet' };
// The next deadline in the Deadlines headings' own words ("Must reach their last committee by Mon 3/30": model.js gateHead,
// one name for one deadline, R-352 FIX-2, C-15 on v6).
const dlWords = j => j.D && j.alive ? gateHead(j.D.label, dayWords(j.D.date)) : '';
const COLS = [
  ['issue', 'Issue', j => j.i.name],
  ['house', 'HB (House-started)', j => j.H.length ? j.H.map(y => [numWords(y.b), whereNow(y.st)].filter(Boolean).join(', ')).join('; ') : `none${j.goneH.length ? ` · ${j.goneH.length} stopped` : ''}`],
  ['senate', 'SB (Senate-started)', j => j.S.length ? j.S.map(y => [numWords(y.b), whereNow(y.st)].filter(Boolean).join(', ')).join('; ') : `none${j.goneS.length ? ` · ${j.goneS.length} stopped` : ''}`],
  ['deadline', 'Next deadline', dlWords],
  ['state', 'Cleared', j => j.alive ? (j.kind === 'oppose' ? 'HIPHI opposes' : DSTATE[j.dstate] || '') : 'Stopped'],
  ['next', 'Next step', j => j.next?.text || j.health.text],
  ['owner', 'Owner', j => ownerName(j.i)],
];
const SORTV = { deadline: j => j.D && j.alive ? j.D.date : '9', state: j => ({ risk: 0, notyet: 1, cleared: 2 })[j.dstate] ?? 3 };
function sorted(js) {
  const s = S.miSort; if (!s) return [...js].sort((a, b) => (a.alive ? 0 : 1) - (b.alive ? 0 : 1) || (a.needs ? 0 : 1) - (b.needs ? 0 : 1) || byUrgency(a.x, b.x));
  const c = COLS.find(x => x[0] === s[0]), val = SORTV[s[0]] || c[2];
  return [...js].sort((a, b) => String(val(a)).localeCompare(String(val(b)), 'en', { numeric: true }) * s[1] || a.i.name.localeCompare(b.i.name));
}
// Lucide's arrow-up-down, as Bills' spreadsheet draws it (bills.js UPDOWN), so icons.js stays as it is.
const UPDOWN = '<svg class="ic ic-arrow-up-down" width="1.25em" height="1.25em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="m21 16-4 4-4-4"/><path d="M17 20V4"/><path d="m3 8 4-4 4 4"/><path d="M7 4v16"/></svg>';
let LAST = [];
function sheetHTML(js) {
  const s = S.miSort, rows = sorted(js); LAST = rows;
  const cell = (k, j) => {
    if (k === 'issue') return `<a class="mi-tlink" href="${href(j.i)}" data-mirow="${esc(j.i.id)}">${topicIc(j.i)}<span>${esc(j.i.name)}</span></a>${tagsOf(j).length ? `<span class="mi-q mi-ttag">${esc(tagsOf(j).join(', '))}</span>` : ''}`;
    if (k === 'state') { const t = COLS[4][2](j), ic = { Cleared: 'circle-check', 'At risk': 'triangle-alert', 'Not yet': 'clock', Stopped: 'circle-minus', 'HIPHI opposes': 'circle-x' }[t];
      return t ? `<span class="mi-st${t === 'Cleared' ? ' t-done' : ''}">${ic ? icon(ic) : ''}${esc(t)}</span>` : ''; }
    if (k === 'next') return j.next ? `<span class="mi-tnext">${j.next.html}</span>` : esc(j.health.text);
    if (k === 'deadline') return j.D && j.alive ? `<span title="${esc(glossOf(j.D))}">${esc(dlWords(j))}</span>` : '';
    const col = COLS.find(x => x[0] === k); return esc(col[2](j));
  };
  return `<div class="mi-sheetbar"><p class="mi-sub">${esc(plural(rows.length, 'issue'))}. Press a heading to sort.</p><button type="button" class="btn text sm mi-copy" data-micopy>${icon('copy')}<span>Copy for Google Sheets</span></button></div>
    <div class="mi-tblbox"><table class="mi-tbl"><caption class="sr">Your issues, one row each</caption><thead><tr>${COLS.map(([k, l]) => { const on = s && s[0] === k;
      return `<th scope="col" class="mi-th-${k}" aria-sort="${on ? (s[1] > 0 ? 'ascending' : 'descending') : 'none'}"><button type="button" class="mi-sort${on ? ' on' : ''}" data-misort="${k}"><span>${esc(l)}</span>${on ? icon(s[1] > 0 ? 'move-up' : 'move-down') : UPDOWN}</button></th>`; }).join('')}</tr></thead>
    <tbody>${rows.map(j => `<tr class="${j.alive ? '' : 'off'}">${COLS.map(([k]) => k === 'issue' ? `<th scope="row" class="mi-td-issue">${cell(k, j)}</th>` : `<td class="mi-td-${k}">${cell(k, j)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
export function sheetText(rows = LAST) {
  const clean = t => String(t ?? '').replace(/[\t\r\n]+/g, ' ').replace(/\u00a0/g, ' ').trim();
  return [COLS.map(c => c[1]), ...rows.map(j => COLS.map(c => clean(c[2](j))))].map(r => r.join('\t')).join('\n');
}
async function copySheet() {
  const n = LAST.length; if (!n) return toast('No issues are shown, so there is nothing to copy.');
  const text = sheetText(); let ok = false;
  try { await navigator.clipboard.writeText(text); ok = true; } catch { /* below: the older way */ }
  if (!ok) { const t = document.createElement('textarea'); t.value = text; t.setAttribute('readonly', ''); t.style.cssText = 'position:fixed;left:-9999px;top:0';
    document.body.appendChild(t); t.select(); try { ok = document.execCommand('copy'); } catch { ok = false; } t.remove(); }
  toast(ok ? `Copied ${plural(n, 'issue')}. Paste into Google Sheets or Excel.` : 'This browser would not copy. Select the table and copy it by hand.', ok ? { ok: true } : { err: true });
}

// ---- wiring: everything inside the body is wired again after each paint ----
export function wireBody(root, { paint }) {
  const body = root.querySelector('#mi-q-body'); if (!body) return;
  body.querySelectorAll('[data-misort]').forEach(b => b.onclick = () => { const k = b.dataset.misort, s = S.miSort;
    S.miSort = s && s[0] === k ? (s[1] > 0 ? [k, -1] : null) : [k, 1]; paint(); root.querySelector(`[data-misort="${k}"]`)?.focus(); });
  body.querySelector('[data-micopy]')?.addEventListener('click', copySheet);
  body.querySelectorAll('[data-mijump]').forEach(b => b.onclick = () => { const t = body.querySelector(`#mi-t-${CSS.escape(b.dataset.mijump)}`);
    if (t) { t.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); t.querySelector('h2')?.setAttribute('tabindex', '-1'); t.querySelector('h2')?.focus({ preventScroll: true }); } });
}
export function wireSwitch(root, { paint }) {
  const pick = v => { setViewNow(v); root.querySelectorAll('[data-miview]').forEach(o => o.setAttribute('aria-pressed', String(o.dataset.miview === v))); paint(); };
  root.querySelectorAll('[data-miview]').forEach(b => b.onclick = () => pick(b.dataset.miview));
}
// Back from an issue opened here puts the focus on the item it was opened from (rule 10), on any view.
export function restoreMine(root, recent) {
  const id = S.i6Back; if (!id) return false;
  const a = root.querySelector(`[data-mirow="${CSS.escape(id)}"]`); if (!a) return false;
  S.i6Back = null;
  setTimeout(() => { if (!recent()) return; a.focus({ preventScroll: true }); const r = a.getBoundingClientRect(); if (r.top < 0 || r.bottom > innerHeight) a.scrollIntoView({ block: 'center' }); }, 30);
  return true;
}
