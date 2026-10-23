// Coalitions (#/my-issues/coalitions, the second tab of My issues; #/coalition redirects there) and one coalition
// (#/coalition/<id>). A person comes here to see where one coalition stands this week (B-1). One coalition is for its owner
// and for the support staff who help it and keep its partners informed (Kris and Saya, review 9/21): its hearings in the
// next 7 days, its bills that still need a hearing (at risk first), the live bills nobody owns, and the to-dos on its bills
// that anyone can take. "I help on <coalition>" is saved to your own settings (advocates.prefs.coalitions, 'all' or a list
// of ids; decision 7); its owner has the coalition's bills on Today already, so the owner has no switch. Share with
// partners holds the public page's link and the website-box code, each with a Copy button, and its issues' public pages.
// The public page: since R-018 the public tracker is organised by issue, but a coalition's own address
// (track.html#/issue/<coalition slug>) still opens its page of bills (pub/find.js keeps it for the links partners have).
//
// v6 (R-336 spec 6, V07, V04, D16): led by where it stands. One line says it first (at risk, or safe, and the hearings
// this week), then the sections, each a list of rows of the shared shape (steps.js itemRow: a name and one line). This page
// shows each step's STATUS and links to its home: a hearing to its page, a chair ask to Hearings › Get hearings (Email the
// chair and Mark asked live there, on Today and on the bill: the addendum's rule 1). The only buttons are the ones that are
// this page's own: Take it (a bill nobody owns, a to-do anyone can take), the I help switch and the two Copy buttons.
// Coalitions index: rows, the coalitions you help on first (F157), the others each with an "I help" switch (F159).
import { S, DB, DEMO, SESSION_OVER, hooks, esc, advocate } from './data.js';
import { billSay, diedish, riskOf, PUBLIC_APP, hiToday, billById, wantsHearing, billRoute, sittingDraft, whenAt } from './model.js';
import { ownerFirst, ownerName } from './model.js';   // R-316 W28: "Lauren (turned off)"
import { icon, btn, empty, toast, switchRow, openSheet } from './ui.js';
import { showAllBtn } from './ui.js';   // R-277 fix 4 (U-4): one "Show all" on every screen
import { plural, pageHead, afterClose, iconName } from './lists.js';
import { sectionNav } from './ui.js';
import { issuesOfBill } from './issues.js';
import { isPos, byPri, waitingOfBills } from './standing.js';
import { itemRow, billStep, shownStatus, testimonyState, goingWords, committeeName, numWords, nameWords, dayWords, nw } from './steps.js';

const WEEK = 7 * 864e5, FOLD = 6;
const DESK = () => { try { return matchMedia('(min-width: 1100px)').matches; } catch { return false; } };
const coalById = id => (S.campaigns || []).find(c => String(c.id) === String(id)) || null;
const andList = xs => xs.length < 2 ? xs.join('') : xs.length === 2 ? `${xs[0]} and ${xs[1]}` : `${xs.slice(0, -1).join(', ')}, and ${xs[xs.length - 1]}`;
const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
// A redraw that keeps the page where it was and the focus on the control that acted (B-4).
function redrawKeep(focusSel) {
  const y = window.scrollY; hooks.render();
  const n = focusSel ? document.querySelector(focusSel) : null; if (n) n.focus({ preventScroll: true });
  if (Math.abs(window.scrollY - y) > 1) window.scrollTo(0, y);
}

// ---- the numbers, the same on the index and on the page (A-14) ----
const billsOf = c => S.bills.filter(b => b.tracked !== false && (S.billCampaigns[b.id] || []).includes(c.id));
// Live bills with a position: the ones the coalition is working on now (Monitor is a decided position, not work; R-022 decision 5).
const liveOf = c => billsOf(c).filter(b => isPos(b) && !diedish(b));
const unownedOf = c => liveOf(c).filter(b => !(S.assignments[b.id] || []).length).sort(byPri);
const openTodosOf = c => billsOf(c).flatMap(b => (S.todos[b.id] || []).filter(t => !t.done && !t.assignee_id).map(t => ({ t, b })))
  .sort((x, y) => String(x.t.due_date || '9999').localeCompare(String(y.t.due_date || '9999')) || byPri(x.b, y.b));
// Its hearings in the next 7 days, one per sitting, on bills with a position; hearings on bills it only monitors stay out
// (decision 4). From any set of bills: a coalition's here, an issue's on its page.
export function weekOfBills(bills) {
  const now = Date.now(), ids = new Set(bills.filter(isPos).map(b => b.id)), by = new Map();
  for (const h of S.hearings || []) {
    if (h.status === 'cancelled' || !ids.has(h.bill_id)) continue;
    const t = new Date(h.scheduled_at).getTime(); if (t <= now || t - now > WEEK) continue;
    const k = `${h.committee}|${h.scheduled_at}`; if (!by.has(k)) by.set(k, { t, rows: [] }); by.get(k).rows.push(h);
  }
  return [...by.values()].sort((x, y) => x.t - y.t);
}
export const weekOf = c => weekOfBills(billsOf(c));
// Your help: 'all' (Kris), a list of ids (Saya: CTFH), or nothing yet.
const pref = () => S.me?.prefs?.coalitions;
export const supports = c => { const v = pref(); return v === 'all' || (Array.isArray(v) && v.includes(c.id)); };
const ownsCoal = c => !!S.me && c.owner_id === S.me.id;
// R-316 W45: the link on the coalition's card says where it came from, so partners' visits are counted apart.
const publicLink = c => `${PUBLIC_APP()}?utm_source=coalition-card&utm_campaign=${String(c.slug || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40)}#/issue/${encodeURIComponent(c.slug)}`;
const embedUrl = (c, { preview = false } = {}) => { const u = new URL('embed.html', location.href); u.search = ''; u.hash = ''; if (preview && DEMO) u.searchParams.set('demo', '1'); u.searchParams.set('coalition', c.slug); return u.href; };
const embedCode = c => `<iframe id="hiphi-tracker" src="${embedUrl(c)}" title="${esc(`HIPHI: ${c.public_name || c.name} bills`)}" style="width:100%;border:0;min-height:420px" loading="lazy"></iframe>\n<script>addEventListener('message',function(e){if(e.data&&e.data.hiphiTrackerHeight)document.getElementById('hiphi-tracker').style.height=e.data.hiphiTrackerHeight+'px'})<\/script>`;
// The partner update lives on Outreach's Partner update tab (one way in, B-13), opened on this coalition (v4, R-269).
const memoHref = c => `#/outreach/partners?coalition=${encodeURIComponent(c.id)}`;
// Bills, opened on every bill of this coalition (filters.js openCoalition).
const billsHref = c => `#/bills?coalition=${encodeURIComponent(c.id)}`;
const coalHref = c => `#/coalition/${encodeURIComponent(c.id)}`;
// Its issues, from its bills: each has its own public page, which is what R-018 made the public tracker's unit.
function issuesOf(c) {
  const seen = new Map();
  for (const b of billsOf(c)) for (const i of issuesOfBill(b.id)) seen.set(i.id, i);
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
}

// Copy on the tap (that is what lets the browser write the clipboard); if it refuses, show the text to copy by hand
// (list.js does the same; never window.prompt).
function copyText(text, okMsg, what) {
  const fallback = async () => {
    await afterClose();
    openSheet({ title: `Copy the ${what}`, size: 'auto', body: `<div class="le-sheet"><p class="small">Select it all and copy it.</p><textarea class="le-copybox" readonly rows="${what === 'link' ? 2 : 6}" aria-label="The ${what}">${esc(text)}</textarea></div>`,
      wire: d => { const ta = d.querySelector('textarea'); ta.focus(); ta.select(); } });
  };
  try { navigator.clipboard.writeText(text).then(() => toast(okMsg, { ok: true }), fallback); } catch { fallback(); }
}

// ============================================================================================ the index
const facts = c => ({ own: advocate(c.owner_id), live: liveOf(c).length, hear: weekOf(c).length, you: supports(c) });
const hearWords = n => n ? plural(n, 'hearing') + ' this week' : 'no hearings this week';
// "Lauren · 22 live bills, 3 hearings this week": a coalition in one line, two facts (spec 8), on the index and on My issues
// for someone who owns no issue, in the same words. W28: an owner who is turned off "needs a new owner" (ownerFirst).
export const coalFactsLine = c => { const f = facts(c); return [f.own ? (f.own.id === S.me?.id ? 'You own it' : ownerFirst(f.own)) : 'No owner', `${f.live ? plural(f.live, 'live bill') : 'no live bills'}, ${hearWords(f.hear)}`].join(' · '); };
const byOrder = (a, b) => (a.sort_order ?? 99) - (b.sort_order ?? 99) || a.name.localeCompare(b.name);
// One coalition as a row: its short name, its public name small beside it (X25: "HEAL" alone said nothing to Patti), and
// one line. `button`: the I help switch, on the coalitions someone does not help on yet.
export function coalRow(c, { button = '' } = {}) {
  return itemRow({ key: c.id, name: c.name, num: c.public_name && c.public_name !== c.name ? c.public_name : '', line: nw(esc(coalFactsLine(c))), href: coalHref(c), button, cls: 'i6-row co6-row' });
}
// The switch is a toggle button (aria-pressed), the one control a row may carry (D16); turning it on moves the coalition
// up to yours, with Undo (setSupport).
export const helpBtn = c => btn('I help', { kind: 'secondary', sm: true, icon: 'user-plus', attrs: { 'data-misup': c.id, 'aria-pressed': 'false', 'aria-label': `I help on ${c.name}` } });
export function coalSectionsHTML({ yoursTitle = '', othersTitle = '' } = {}) {
  const all = (S.campaigns || []).slice().sort(byOrder), mine = all.filter(c => supports(c) || ownsCoal(c)), rest = all.filter(c => !mine.includes(c));
  const box = rows => `<div class="v6-list i6-list" role="list">${rows}</div>`;
  return `${mine.length ? `<section class="i6-sec" aria-labelledby="co6-yh"><h2 class="i6-h" id="co6-yh">${esc(yoursTitle || (mine.length === 1 ? 'Your coalition' : 'Your coalitions'))}</h2>${box(mine.map(c => coalRow(c)).join(''))}</section>` : ''}
    ${rest.length ? `<section class="i6-sec" aria-labelledby="co6-oh"><h2 class="i6-h" id="co6-oh">${esc(othersTitle || (mine.length ? 'Other coalitions' : 'Coalitions'))}</h2>${box(rest.map(c => coalRow(c, { button: helpBtn(c) })).join(''))}</section>` : ''}`;
}
export function wireHelpBtns(root) {
  root.querySelectorAll('[data-misup]').forEach(el => el.onclick = () => {
    const c = coalById(el.dataset.misup); if (!c) return;
    setSupport(c, true, `.co6-row[data-v6row="${CSS.escape(String(c.id))}"] .v6-row-main`);
  });
}
function indexHTML() {
  const v = pref(), list = (S.campaigns || []).slice().sort(byOrder);
  const yours = v === 'all' ? 'You help on every coalition.' : '';
  const head = pageHead(sectionNav('issues', 'coalitions'), 'Coalitions', yours ? esc(yours) : '', '');
  if (!list.length) return `<div class="le-page co6-index">${head}<div class="le-empty">${empty({ title: 'No coalitions yet', text: 'An admin adds them in Session setup.', action: S.me?.is_admin ? btn('Open Session setup', { href: '#/setup/coalitions' }) : '' })}</div></div>`;
  return `<div class="le-page co6-index">${head}${coalSectionsHTML({ yoursTitle: v === 'all' ? 'Every coalition' : '' })}</div>`;
}

// ============================================================================================ one coalition
const sec = (id, title, inner, { lede = '', more = '' } = {}) => `<section class="i6-sec co6-sec" aria-labelledby="${id}"><h2 class="i6-h" id="${id}">${title}</h2>${lede}${inner}${more}</section>`;
const box = rows => `<div class="v6-list i6-list" role="list">${rows}</div>`;
// Long lists show their first rows; "Show all" opens the rest in place (remembered for this visit).
function folded(key, rows) {
  if (rows.length <= FOLD + 2 || S.coMore?.has(key)) return box(rows.join(''));
  return box(rows.slice(0, FOLD).join('')) + showAllBtn(rows.length, { 'data-comore': key });
}
// A row's line kept to two facts (spec 8: four a row with the name and number): the tail after the second " · " joins it.
const two = s => { const p = String(s || '').split(' · '); return p.length > 2 ? [p[0], p.slice(1).join(', ')].join(' · ') : String(s || ''); };
// A bill's row with its own step's line (steps.js billStep: the viewer's own step bold when due today; someone else's in
// neutral words, D3), and no button (V07: the step's button lives at its home).
export function billLineRow(b, { line, button = '', cls = '' } = {}) {
  const s = billStep(b), st = shownStatus(s) || {}, own = !!s?.you;
  const text = line != null ? line : two(s?.line || '');
  const tone = line == null && st.tone && st.tone !== 'neutral' ? st.tone : '';
  const ic = line != null ? '' : tone ? st.icon : (st.soon && own) ? 'clock' : '';
  return itemRow({ key: b.id, name: nameWords(b), num: numWords(b), line: nw(esc(text)), tone, icon: ic, bold: !!(st.soon && own && line == null), href: billRoute(b), button, cls: `i6-row${cls ? ' ' + cls : ''}`, bill: b.id });
}

// Its hearings this week, a row per sitting (status, not steps): the committee, then when, who is going, and where its
// bills' testimony stands in V19's words ("SB 3076: Writing"). Each opens the hearing's page; the I'm going toggle and the
// testimony steps are there and on Hearings (V07). `from` is the hearing page's way back.
function sittingRow(s, from) {
  const h = s.rows[0], items = s.rows.map(r => ({ h: r, b: billById(r.bill_id) })).filter(x => x.b).sort((x, y) => byPri(x.b, y.b));
  const states = items.map(x => testimonyState(sittingDraft(x.h, x.b.id) || null, x.b, { h: x.h })).filter(Boolean);
  const said = items.length === 1 && states[0] ? `${numWords(items[0].b)}: ${states[0].word}${states[0].sentBack ? ', sent back' : ''}`
    : `${plural(items.length, 'bill')}${states.length ? `: ${[...new Set(states.map(x => x.word))].join(', ')}` : ''}`;
  const href = `#/hearing/${encodeURIComponent(h.id)}${from ? `?from=${encodeURIComponent(from)}` : ''}`;
  return itemRow({ key: h.id, name: committeeName(h.committee) || h.committee, line: [cap(whenAt(h.scheduled_at)), goingWords(h), said].map(t => nw(esc(t))).join(' · '), icon: 'calendar-days', href, cls: 'i6-row' });
}
export function hearingsSec(bills, { key = '', from = '' } = {}) {
  const week = weekOfBills(bills); if (!week.length) return '';
  return sec(`co6-h-${esc(key)}`, 'Hearings this week', folded(key + '|h', week.map(s => sittingRow(s, from))),
    { more: `<p class="i6-more-link"><a href="#/hearings">See them on Hearings${icon('chevron-right')}</a></p>` });
}
// The bills that still need a hearing, grouped by the deadline they race, at risk first (no hearing, deadline a week away
// or less, model.js riskOf). Bills HIPHI opposes are left out (W2: a hearing is what we do not want for them). Each row is
// the bill's step in the shared words ("Ask the chair by Wed 3/25", "Asked by Kevin Mon 3/16 · no reply yet", "Kris asks
// the chair by Fri 3/27"); asking is done on Get hearings, so the section links there (V07).
function needsSecs(key, w) {
  const all = [...w.risk, ...w.race.filter(x => !w.risk.some(y => y.b.id === x.b.id))].filter(x => wantsHearing(x.b) && x.st.deadline?.date);
  if (!all.length) return '';
  const by = new Map(); for (const x of all) { const d = x.st.deadline.date; if (!by.has(d)) by.set(d, { risk: false, rows: [] }); const g = by.get(d); g.rows.push(x); if (riskOf(x.b)) g.risk = true; }
  return [...by].sort(([p], [q]) => p.localeCompare(q)).map(([d, g], i) => sec(`co6-n-${esc(key)}-${i}`, `${g.risk ? 'At risk: needs' : 'Needs'} a hearing by ${esc(dayWords(d))}`,
    folded(`${key}|${d}`, g.rows.map(x => billLineRow(x.b))), { more: i === by.size - 1 ? `<p class="i6-more-link"><a href="#/hearings/ask">Ask on Get hearings${icon('chevron-right')}</a></p>` : '' })).join('');
}
// The lead line: where it stands, said once (status by exception, D3; words and an icon, never colour alone, A-5).
export function standLeadHTML(bills, { clear = [] } = {}) {
  if (SESSION_OVER) return `<p class="i6-lead">${icon('calendar')}<span>Between sessions: hearings and deadlines come back when the next session opens.</span></p>`;
  const w = waitingOfBills(bills), wk = weekOfBills(bills).length;
  const risk = w.risk.filter(x => wantsHearing(x.b)), race = w.race.filter(x => wantsHearing(x.b));
  const said = risk.length ? { ic: 'triangle-alert', t: `At risk: ${plural(risk.length, 'bill')} ${risk.length === 1 ? 'needs' : 'need'} a hearing by ${dayWords(risk[0].st.deadline.date)}` }
    : race.length ? { ic: 'clock', t: `Nothing at risk. ${plural(race.length, 'bill')} ${race.length === 1 ? 'needs' : 'need'} a hearing by ${dayWords(w.next)}` }
    : { ic: 'shield-check', t: `Nothing at risk${clear.length ? `, ${andList(clear)}` : ''}` };
  return `<p class="i6-lead">${icon(said.ic)}<span>${nw(esc(said.t))}${wk ? ` · ${nw(esc(hearWords(wk)))}` : ''}</span></p>`;
}
// Where a set of bills stands this week: the hearings, then the bills that need a hearing. An issue's page uses it too.
// (`clear`, `calm` and `after` are kept from v5's signature; `after` is the caller's own sections.)
export function standWeekHTML(bills, { key = '', from = '', after = '' } = {}) {
  if (SESSION_OVER) return after;
  return `${hearingsSec(bills, { key, from })}${needsSecs(key, waitingOfBills(bills))}${after}`;
}
// "Show all" in those sections, for a page that is not this one (the coalition page wires its own below).
export function wireWeek(root, redraw = () => hooks.render()) {
  root.querySelectorAll('[data-comore]').forEach(el => el.onclick = () => { (S.coMore ??= new Set()).add(el.dataset.comore); redraw(); });
}
// Live bills nobody owns, each with Take it (F158). Giving one to someone else is on the bill (its owner picker).
function unownedHTML(c, list) {
  const rows = list.map(b => billLineRow(b, { line: two(billStep(b)?.line || ''), button: btn('Take it', { kind: 'secondary', sm: true, attrs: { 'data-cotakebill': b.id, 'aria-label': `Take ${billSay(b)}: you become its owner` } }) }));
  return sec('co6-s3', 'Bills nobody owns', folded(c.id + '|o', rows));
}
// To-dos on its bills with nobody on them ("Anyone" on the bill page). Taking one is yours to do, so nobody is messaged
// (064 only tells a person when someone ELSE gives them a to-do). Past its date is said in words, not red (D3: red is only
// a step of yours overdue, and this one is nobody's yet).
function todosHTML(c, list) {
  const today = hiToday();
  const rows = list.map(({ t, b }) => {
    const due = !t.due_date ? '' : t.due_date < today ? `was due ${dayWords(t.due_date)}` : t.due_date === today ? 'due today' : `due ${dayWords(t.due_date)}`;
    return itemRow({ key: `${b.id}|${t.id}`, name: t.title, line: [`${nameWords(b, 48)} (${numWords(b)})`, due].filter(Boolean).map(x => nw(esc(x))).join(' · '), href: billRoute(b), cls: 'i6-row',
      button: btn('Take it', { kind: 'secondary', sm: true, attrs: { 'data-cotake': `${b.id}|${t.id}`, 'aria-label': `Take “${t.title}” on ${billSay(b)}` } }) });
  });
  return sec('co6-s4', 'To-dos anyone can take', folded(c.id + '|t', rows));
}

function headHTML(c) {
  const own = advocate(c.owner_id), live = liveOf(c).length;
  return `<header class="co6-head">
    <span class="co6-icon" aria-hidden="true">${icon(iconName(c.icon))}</span>
    <div class="co6-hbody">
      <h1 class="co6-h1">${esc(c.name)}</h1>
      ${c.public_name && c.public_name !== c.name ? `<p class="co6-pub">${esc(c.public_name)}</p>` : ''}
      <p class="co6-meta"><span>${own ? `Owner: ${esc(own.id === S.me?.id ? 'you' : ownerName(own))}` : `No owner${S.me?.is_admin ? ` · <a href="#/setup/coalitions">choose one in Session setup</a>` : ''}`}</span><span aria-hidden="true"> · </span><span>${esc(live ? plural(live, 'live bill') : 'No live bills')}</span><span aria-hidden="true"> · </span><a href="${esc(billsHref(c))}">See all its bills</a></p>
    </div>
  </header>`;
}

// Your help ("support" is Nate's word, decision 7). The owner has the coalition's bills on Today already, so no switch.
function supportHTML(c) {
  if (!S.me || c.owner_id === S.me.id) return '';
  const v = pref(), on = supports(c);
  // R-277 fix 21 (W-8): "I support CTFH" read as a position on tobacco. The switch says what it is (you help on it) and
  // what it does (its work shows on your Today); "Monitor" stays a position only.
  const help = `Its hearings and deadlines show on your Today, never in its count.${v === 'all' ? ' You help on every coalition.' : ''}`;
  return `<section class="co6-card co6-sup" aria-label="Your help">${switchRow('co-sup', `I help on ${esc(c.name)}`, on, esc(help))}</section>`;
}

// Share with partners (F160): the two things to copy (A-20: two actions on the card), with the link itself and a preview
// as plain links, and each issue's public page behind one fold (reference, rule 3).
function shareHTML(c) {
  const newTab = '<span class="sr"> (opens in a new tab)</span>';
  if (!c.is_public || !c.slug) return `<section class="co6-card co6-share" aria-labelledby="co-h-share"><h2 id="co-h-share">Share with partners</h2>
    <p class="co6-note">${icon('eye-off')}<span>${esc(c.name)} is not on the public tracker, so it has no public page or website box.</span></p></section>`;
  const link = publicLink(c), iss = issuesOf(c), open = !!S.coIss?.has(c.id);
  return `<section class="co6-card co6-share" aria-labelledby="co-h-share"><h2 id="co-h-share">Share with partners</h2>
    <div class="co6-sh">
      <p class="co6-shl">Public page</p>
      <a class="co6-url" href="${esc(link)}" target="_blank" rel="noopener">${esc(link.replace(/^https?:\/\//, ''))}${newTab}</a>
      ${btn('Copy link', { kind: 'secondary', sm: true, icon: 'link', attrs: { 'data-cocopy': 'link', 'aria-label': 'Copy the public page link' } })}
    </div>
    <div class="co6-sh">
      <p class="co6-shl">Website box</p>
      <p class="co6-shd">Its bills and HIPHI’s positions, on a partner’s own website. <a href="${esc(embedUrl(c, { preview: true }))}" target="_blank" rel="noopener">See it${newTab}</a></p>
      ${btn('Copy code', { kind: 'secondary', sm: true, icon: 'copy', attrs: { 'data-cocopy': 'embed', 'aria-label': 'Copy the website box code' } })}
    </div>
    ${iss.length ? `<details class="co6-iss"${open ? ' open' : ''}><summary><span>Its issues on the public tracker (${iss.length})</span>${icon('chevron-down', { cls: 'i6-chev' })}</summary>
      <ul>${iss.map(i => `<li><a href="${esc(`${PUBLIC_APP()}#/issue/${encodeURIComponent(i.slug)}`)}" target="_blank" rel="noopener">${esc(i.name)}${newTab}</a></li>`).join('')}</ul></details>` : ''}
  </section>`;
}

function pageHTML(c) {
  const back = `<a class="co6-back" href="#/my-issues/coalitions" data-back>${icon('chevron-left')}<span>Coalitions</span></a>`;
  const unowned = unownedOf(c), todos = openTodosOf(c), bills = billsOf(c);
  const anyTodo = bills.some(b => (S.todos[b.id] || []).some(t => !t.done));
  const clear = !unowned.length && !anyTodo ? [liveOf(c).length ? 'every live bill has an owner' : '', 'no open to-dos'].filter(Boolean) : [];
  const lead = standLeadHTML(bills, { clear });
  const week = standWeekHTML(bills, { key: c.id, from: c.id, after: `${unowned.length ? unownedHTML(c, unowned) : ''}${todos.length ? todosHTML(c, todos) : ''}` });
  // The partner update is the coalition's weekly job for its owner and helpers: one tonal button under the lead (one door,
  // Outreach › Partner update, B-13).
  const act = `<p class="co6-acts">${btn('Write a partner update', { kind: 'secondary', icon: 'mail', href: memoHref(c) })}</p>`;
  const side = `${supportHTML(c)}${shareHTML(c)}`;
  if (!DESK()) return `<div class="co6-page">${back}${headHTML(c)}${lead}${act}${week}${side}</div>`;
  return `<div class="co6-page co6-desk">${back}<div class="co6-cols">
    <div class="co6-main">${headHTML(c)}${lead}${act}${week}</div>
    <aside class="co6-side" aria-label="Your help, and sharing with partners">${side}</aside>
  </div></div>`;
}

// ---- actions ----
// Exported for My issues and the Coalitions tab, whose I help buttons act the same way; `focusSel` is the control that
// keeps focus after the redraw.
export async function setSupport(c, on, focusSel = '#co-sup') {
  const before = pref(), ids = (S.campaigns || []).map(x => x.id), list = Array.isArray(before) ? before : [];
  // From "every coalition", turning one off keeps the rest as a list; turning one on keeps "every" as it is.
  const next = on ? (before === 'all' ? 'all' : [...new Set([...list, c.id])]) : (before === 'all' ? ids.filter(id => id !== c.id) : list.filter(id => id !== c.id));
  try { await DB.patchPrefs({ coalitions: next }); } catch (e) { redrawKeep(focusSel); toast(e, { err: true }); return; }
  redrawKeep(focusSel);
  toast(on ? `You help on ${c.name}. Its work shows on your Today.` : before === 'all' ? `You no longer help on ${c.name}. You still help on the other ${ids.length - 1}.` : `You no longer help on ${c.name}.`,
    { ok: on, undo: async () => { await DB.patchPrefs({ coalitions: before }); redrawKeep(focusSel); } });
}
async function takeBill(b) {
  if (!S.me) return;
  const was = S.assignments[b.id] || [];
  try { await DB.setOwner(b.id, S.me.id); } catch (e) { toast(e, { err: true }); return; }
  redrawKeep();
  toast(`You own ${billSay(b)} now.`, { ok: true, undo: async () => { await DB.setOwner(b.id, was[0] || null); redrawKeep(); } });
}
export { takeBill };
async function takeTodo(key) {
  const [bid, tid] = key.split('|'), b = S.bills.find(x => String(x.id) === bid), t = (S.todos[bid] || []).find(x => String(x.id) === tid);
  if (!b || !t || !S.me) return;
  try { await DB.updateTodo(b.id, t.id, { assignee_id: S.me.id }); } catch (e) { toast(e, { err: true }); return; }
  redrawKeep();
  toast(`It’s yours: “${t.title}” on ${billSay(b)}.`, { ok: true, undo: async () => { await DB.updateTodo(b.id, t.id, { assignee_id: null }); redrawKeep(); } });
}

export default {
  tab: 'myissues',   // the second tab of My issues
  // One coalition is two columns from 1100px, which need more than the reading column.
  wide: route => !!route.id && DESK(),
  title: route => route.id ? coalById(route.id)?.name || 'Coalition' : 'Coalitions',
  back: route => route.id ? { href: '#/my-issues/coalitions', label: 'Coalitions' } : null,
  render(route) {
    if (!route.id) return indexHTML();
    const c = coalById(route.id);
    // Never a dead end (B-3): a coalition an admin removed, or a link from another setup.
    if (!c) return `<div class="co6-page">${empty({ h: 'h1', title: 'We could not find that coalition', text: 'It may have been removed or renamed in Session setup.', action: btn('See all coalitions', { kind: 'secondary', href: '#/my-issues/coalitions' }) })}</div>`;
    return pageHTML(c);
  },
  wire(route, app) {
    if (!route.id) { wireHelpBtns(app); return; }
    const c = coalById(route.id), root = app.querySelector('.co6-page'); if (!c || !root) return;
    const sw = root.querySelector('#co-sup'); if (sw) sw.onchange = () => setSupport(c, sw.checked);
    root.querySelectorAll('[data-cocopy]').forEach(el => el.onclick = () => el.dataset.cocopy === 'link'
      ? copyText(publicLink(c), 'Link copied.', 'link') : copyText(embedCode(c), 'Website box code copied.', 'website box code'));
    root.querySelectorAll('[data-cotakebill]').forEach(el => el.onclick = () => { const b = billById(el.dataset.cotakebill); if (b) takeBill(b); });
    root.querySelectorAll('[data-cotake]').forEach(el => el.onclick = () => takeTodo(el.dataset.cotake));
    wireWeek(root, () => redrawKeep());
    root.querySelector('.co6-iss')?.addEventListener('toggle', e => { const s = (S.coIss ??= new Set()); if (e.currentTarget.open) s.add(c.id); else s.delete(c.id); });
  },
};
