// Coalitions (#/issues/coalitions, the second tab of My issues; #/coalition redirects there) and one coalition
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
import { diedish, riskOf, PUBLIC_APP, hiToday, billById, wantsHearing, billRoute, sittingDraft, whenAt } from './model.js';
import { ownerFirst, ownerName } from './model.js';   // R-316 W28: "Lauren (turned off)"
import { icon, btn, empty, toast, switchRow, openSheet, ASK_TAB, andWords } from './ui.js';
import { showAllBtn } from './ui.js';   // R-277 fix 4 (U-4): one "Show all" on every screen
import { plural, afterClose, iconName } from './lists.js';
import { issuesOfBill } from './issues.js';
import { headHTML as tabsHead, rememberRow, restoreRow, numNb, issueTile } from './issuestand.js';
import { isPos, byPri, waitingOfBills } from './standing.js';
import { statusLine, itemRow, billStep, shownStatus, testimonyState, goingWords, committeeName, numWords, nameWords, dayWords, nw } from './steps.js';
import { cardHTML, picHTML, groupHTML, restoreCard, topicIcons } from './issuegrid.js';   // R-336 walk 3: the index as cards
import { ICONS } from '../icons.js';

const WEEK = 7 * 864e5, FOLD = 6;
const DESK = () => { try { return matchMedia('(min-width: 1100px)').matches; } catch { return false; } };
const coalById = id => (S.campaigns || []).find(c => String(c.id) === String(id)) || null;
const andList = andWords;   // ui.js's one list join, "A, B and C" (Nate 25 Oct walk 1)
const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
// A bill in a sentence (a toast, a button's label): its name and its number as the rows say them, "Easier local food buying
// for schools (SB 659)", never model.js billSay's "SB659 HD1" (D15; the critic).
export const billWords = b => { const n = numWords(b), nm = nameWords(b, 1e4); return nm && nm !== n ? `${nm} (${n})` : n; };
// "No one holds it" (steps.js) on a bill with no owner says the one wording this place uses for that fact (spec 7 rule 6).
const noOwner = b => !(S.assignments[b.id] || []).length;
const ownerWords = (b, t) => noOwner(b) ? String(t || '').replace(/^No one holds it\b/, 'No owner yet').replace(/\bno one holds it\b/g, 'no owner yet') : String(t || '');
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
// The coming week's hearings on a coalition's monitored bills, soonest first (their times).
const monitorWeek = c => { const now = Date.now(), ids = new Set(billsOf(c).filter(b => b.position === 'monitor').map(b => b.id));
  return (S.hearings || []).filter(h => h.status !== 'cancelled' && ids.has(h.bill_id)).map(h => new Date(h.scheduled_at).getTime()).filter(t => t > now && t - now <= WEEK).sort((x, y) => x - y); };
// Your help: 'all' (Kris), a list of ids (Saya: CTFH), or nothing yet.
const pref = () => S.me?.prefs?.coalitions;
export const supports = c => { const v = pref(); return v === 'all' || (Array.isArray(v) && v.includes(c.id)); };
const ownsCoal = c => !!S.me && c.owner_id === S.me.id;
// Who rallies the public for a coalition (the addendum's rule 6, no setting exists yet): Saya on CTFH, else its owner.
const rallierOf = c => (/^ctfh$/i.test(c.slug || c.name) && S.advocates.find(a => a.initials === 'SY' && a.is_active !== false)) || advocate(c.owner_id);
// The partner update is the work of the coalition's own people: its owner, its helpers, its rallier, and admins (the critic:
// a stranger to the coalition saw it as the page's one thing to do; spec D16, A-13).
const mayUpdate = c => !!S.me && (!!S.me.is_admin || ownsCoal(c) || supports(c) || rallierOf(c)?.id === S.me.id);
// R-316 W45: the link on the coalition's card says where it came from, so partners' visits are counted apart.
const publicLink = c => `${PUBLIC_APP()}?utm_source=coalition-card&utm_campaign=${String(c.slug || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40)}#/issue/${encodeURIComponent(c.slug)}`;
const embedUrl = (c, { preview = false } = {}) => { const u = new URL('embed.html', location.href); u.search = ''; u.hash = ''; if (preview && DEMO) u.searchParams.set('demo', '1'); u.searchParams.set('coalition', c.slug); return u.href; };
const embedCode = c => `<iframe id="hiphi-tracker" src="${embedUrl(c)}" title="${esc(`HIPHI: ${c.public_name || c.name} bills`)}" style="width:100%;border:0;min-height:420px" loading="lazy"></iframe>\n<script>addEventListener('message',function(e){if(e.data&&e.data.hiphiTrackerHeight)document.getElementById('hiphi-tracker').style.height=e.data.hiphiTrackerHeight+'px'})<\/script>`;
// The partner update lives on Outreach's Partner update tab (one way in, B-13), opened on this coalition (v4, R-269).
const memoHref = c => `#/outreach/partners?coalition=${encodeURIComponent(c.id)}`;
// Bills, opened on every bill of this coalition (filters.js openCoalition).
const billsHref = c => `#/issues/bills?coalition=${encodeURIComponent(c.id)}`;
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
// one line. `button`: the I help switch.
export function coalRow(c, { button = '' } = {}) {
  return itemRow({ key: c.id, name: c.name, num: c.public_name && c.public_name !== c.name ? c.public_name : '', line: nw(esc(coalFactsLine(c))), href: coalHref(c), button, cls: 'i6-row co6-row' });
}
// The I help switch: a toggle button (aria-pressed), the one control a row may carry (D16), on every coalition its owner is
// not (the owner has its work on Today already). Its name stays "I help" either way (WCAG 2.5.3); pressed, it shows a check.
export const helpBtn = (c, on = supports(c)) => btn('I help', { kind: 'secondary', sm: true, icon: on ? 'check' : 'user-plus', cls: 'co6-help',
  attrs: { 'data-misup': c.id, 'aria-pressed': String(on), 'aria-label': `I help on ${c.name}`, title: 'Adds you as a helper: its bills show on your Today' } });
// This visit's switches: a coalition switched here stays in the section it was in until the next visit, showing its new
// state, so the row under the pointer never changes (the critic: pressing I help moved the row up and slid the next one's
// I help under the pointer). A visit is this history entry; a redraw keeps it, arriving again starts afresh.
const visitKey = () => `${location.hash}|${history.state?.d ?? ''}|${history.length}`;
const stays = () => { if (S.coStay?.key !== visitKey()) S.coStay = { key: visitKey(), at: new Map() }; return S.coStay.at; };
export function coalSectionsHTML({ yoursTitle = '', othersTitle = '' } = {}) {
  const all = (S.campaigns || []).slice().sort(byOrder), st = stays();
  const isMine = c => st.has(c.id) ? st.get(c.id) : supports(c) || ownsCoal(c);
  const mine = all.filter(isMine), rest = all.filter(c => !isMine(c));
  const box = rows => `<div class="v6-list i6-list" role="list">${rows}</div>`;
  const row = c => coalRow(c, { button: ownsCoal(c) ? '' : helpBtn(c) });
  return `${mine.length ? `<section class="i6-sec" aria-labelledby="co6-yh"><h2 class="i6-h" id="co6-yh">${esc(yoursTitle || (mine.length === 1 ? 'Your coalition' : 'Your coalitions'))}</h2>${box(mine.map(row).join(''))}</section>` : ''}
    ${rest.length ? `<section class="i6-sec" aria-labelledby="co6-oh"><h2 class="i6-h" id="co6-oh">${esc(othersTitle || (mine.length ? 'Other coalitions' : 'Coalitions'))}</h2>${box(rest.map(row).join(''))}</section>` : ''}`;
}
export function wireHelpBtns(root) {
  root.querySelectorAll('[data-misup]').forEach(el => el.onclick = () => {
    const c = coalById(el.dataset.misup); if (!c) return;
    const st = stays(); if (!st.has(c.id)) st.set(c.id, supports(c) || ownsCoal(c));
    setSupport(c, el.getAttribute('aria-pressed') !== 'true', `[data-misup="${CSS.escape(String(c.id))}"]`);
  });
}
// One line on My issues for someone who helps on a coalition (the critic: Patti's My issues never named HEAL, where her week
// is): "Your coalition: HEAL · 3 hearings this week", its name a link. It replaces the lede (A-25). Kris helps on every one,
// so the Coalitions tab is her list and she gets no line.
export function helpLineHTML() {
  if (!S.me || pref() === 'all') return '';
  const l = (S.campaigns || []).filter(c => supports(c) && !ownsCoal(c)).sort(byOrder); if (!l.length) return '';
  if (l.length > 2) return `<p class="i6-line">${icon('users')}<span>You help on ${l.length} coalitions</span><a class="i6-inline" href="#/issues/coalitions">See them</a></p>`;
  // A monitored bill's hearing is said, not hidden behind "no hearings this week" (Julie: HIAPA's SB 3142 was heard Wed 3/18).
  const one = c => { const n = weekOf(c).length, mon = n ? [] : monitorWeek(c);
    const w = n ? hearWords(n) : mon.length ? `no hearings on bills we support or oppose · ${mon.length} on ${mon.length === 1 ? 'a bill' : 'bills'} we monitor, ${dayWords(mon[0])}` : hearWords(0);
    return `<a href="${esc(coalHref(c))}">${esc(c.name)}</a>${nw(esc(` · ${w}`))}`; };
  return `<p class="i6-line">${icon('users')}<span>${l.length === 1 ? 'Your coalition' : 'Your coalitions'}: ${l.map(one).join('; ')}</span></p>`;
}
// ---- the index as cards (R-336 walk 3, Nate: "Maybe a similar card and image sorting as well here") ----
// The same calm card as All issues (issuegrid.js, R-352): the coalition's small icon beside its name (campaigns.icon, set in
// Session setup; lists.js iconName reads an emoji left from v5 too), none when it has none (no monogram, no band); its short
// name; its full name, which says what it is (X25: "HEAL" alone said nothing to Patti); its owner; and one line of its week, "6 live bills, 2 hearings
// this week". The I help button stays on the card, outside its link (D16: the one button a card may carry), and the card is
// otherwise one link to the coalition. Your coalitions first, then the others, in Session setup's order: with nine
// coalitions a sort would add a control and find nothing faster (A-25), so there is none.
const ownerLine = c => { const o = advocate(c.owner_id); return o ? (o.id === S.me?.id ? 'You own it' : `Owner: ${ownerFirst(o)}`) : 'No owner yet'; };
const weekWords = c => { const f = facts(c); return `${f.live ? plural(f.live, 'live bill') : 'No live bills'}, ${hearWords(f.hear)}`; };
function coalCard(c) {
  // An icon Lucide has, or an emoji v5 kept that iconName knows; anything else gets none, not iconName's stand-in. A topic's
  // icon (HEAL's salad, CTFH's crossed-out cigarette) means that topic on All issues, so here it gets none either.
  const has = !!c.icon && (!!ICONS[c.icon] || iconName(c.icon) !== 'heart-pulse'), ic = has && !topicIcons().has(iconName(c.icon)) ? iconName(c.icon) : '';
  // The full name leads ("Community Health Workers"), the short name after it, small (the critic: "CHW" alone says nothing).
  const words = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ''), full = c.public_name || c.name, short = words(full) !== words(c.name) ? c.name : '';
  return cardHTML({ key: c.id, href: coalHref(c), name: full, after: short, title: c.description || '', cls: 'co6-cell',
    pic: picHTML({ ic }),
    lines: [[esc(ownerLine(c)), 'ig6-desc co6-own'], [`<span>${nw(esc(weekWords(c)))}</span>`, 'ig6-stat']],
    foot: ownsCoal(c) ? '' : helpBtn(c) });
}
export function coalCardsHTML({ yoursTitle = '' } = {}) {
  const all = (S.campaigns || []).slice().sort(byOrder), st = stays();
  const isMine = c => st.has(c.id) ? st.get(c.id) : supports(c) || ownsCoal(c);
  const mine = all.filter(isMine), rest = all.filter(c => !isMine(c));
  const sec = (id, title, l) => groupHTML({ id, title, inner: l.map(c => coalCard(c)).join('') });
  return `<div class="ig6-groups co6-groups">${mine.length ? sec('co6-yh', yoursTitle || (mine.length === 1 ? 'Your coalition' : 'Your coalitions'), mine) : ''}
    ${rest.length ? sec('co6-oh', mine.length ? 'Other coalitions' : 'Coalitions', rest) : ''}</div>`;
}
function indexHTML() {
  const v = pref(), list = (S.campaigns || []).slice().sort(byOrder), head = tabsHead('coalitions');
  if (!list.length) return `<div class="le-page co6-index">${head}<div class="le-empty">${empty({ title: 'No coalitions yet', text: 'An admin adds them in Session setup.', action: S.me?.is_admin ? btn('Open Session setup', { href: '#/setup/coalitions' }) : '' })}</div></div>`;
  return `<div class="le-page co6-index">${head}${coalCardsHTML({ yoursTitle: v === 'all' ? 'You help on every coalition' : '' })}</div>`;
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
  const text = line != null ? line : ownerWords(b, two(s?.line || ''));
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
  // Decision 9: one bill says its status line as every screen does, under its own name (nameWords: one name per bill).
  const one = items.length === 1 ? billStep(items[0].b, { d: sittingDraft(items[0].h, items[0].b.id) || null, h: items[0].h }) : null;
  const said = one?.state ? `${nameWords(items[0].b, 40)}: ${statusLine(one, { who: false, flat: true, soon: false })}`
    : `${plural(items.length, 'bill')}${states.length ? `: ${[...new Set(states.map(x => x.word))].join(', ')}` : ''}`;
  const href = `#/hearing/${encodeURIComponent(h.id)}${from ? `?from=${encodeURIComponent(from)}` : ''}`;
  return itemRow({ key: h.id, name: committeeName(h.committee) || h.committee, line: [cap(whenAt(h.scheduled_at)), goingWords(h), said].map(t => nw(esc(t))).join(' · '), icon: 'calendar-days', href, cls: 'i6-row' });
}
// An issue's page names its own bills (the critic: a bill heard this week had no row of its own there, so its page was two
// clicks away): one row per bill, its name and number, then when and where, and its testimony's state. The row opens the
// bill, whose page holds the hearing.
function billHearRow(h, b) {
  const st = testimonyState(sittingDraft(h, b.id) || null, b, { h });
  const stp = st ? billStep(b, { d: sittingDraft(h, b.id) || null, h }) : null;
  const where = nw(esc(`Hearing ${whenAt(h.scheduled_at)} in ${committeeName(h.committee) || h.committee}`)), state = stp?.state ? nw(esc(statusLine(stp, { who: false, flat: true, soon: false }))) : '';
  return itemRow({ key: `${h.id}|${b.id}`, name: nameWords(b), num: numWords(b), line: [where, state].filter(Boolean).join(' · '), icon: 'calendar-days', href: billRoute(b), cls: 'i6-row', bill: b.id });
}
export function hearingsSec(bills, { key = '', from = '', byBill = false } = {}) {
  const week = weekOfBills(bills); if (!week.length) return '';
  const rows = byBill ? week.flatMap(s => s.rows.map(h => [h, billById(h.bill_id)]).filter(([, b]) => b).sort((x, y) => byPri(x[1], y[1])).map(([h, b]) => billHearRow(h, b)))
    : week.map(s => sittingRow(s, from));
  return sec(`co6-h-${esc(key)}`, 'Hearings this week', folded(key + '|h', rows),
    { more: `<p class="i6-more-link"><a href="#/hearings">See them on Hearings${icon('chevron-right')}</a></p>` });
}
// The bills that still need a hearing, grouped by the deadline they race, at risk first (no hearing, deadline a week away
// or less, model.js riskOf). Bills HIPHI opposes are left out (W2: a hearing is what we do not want for them). Each row is
// the bill's step in the shared words ("Ask the chair by Wed 3/25", "Asked by Kevin Mon 3/16 · no reply yet", "Kris asks
// the chair by Fri 3/27"); asking is done on Get hearings, so the section links there (V07).
// The bills that need a hearing, as one list (the coalition page leaves these out of its no-owner list: a bill shows once).
const needsOf = w => [...w.risk, ...w.race.filter(x => !w.risk.some(y => y.b.id === x.b.id))].filter(x => wantsHearing(x.b) && x.st.deadline?.date);
// Inside a deadline, rows that would say the same line ("Nate asks the chair by Fri 3/27", four times) say it once, as a
// sub-heading ("Nate asks the chairs by Fri 3/27"), and the rows under it are just the bills; a row whose line is its own
// keeps it (the critic, A-14). `take`: a bill with no owner carries Take it here (the coalition page; F158).
function needsSecs(key, w, { take = false } = {}) {
  const all = needsOf(w);
  if (!all.length) return '';
  const by = new Map(); for (const x of all) { const d = x.st.deadline.date; if (!by.has(d)) by.set(d, { risk: false, rows: [] }); const g = by.get(d); g.rows.push(x); if (riskOf(x.b)) g.risk = true; }
  const btnOf = b => take && noOwner(b) ? takeBtn(b) : '';
  // A long deadline shows its first rows across its sub-groups, then one "Show all" for the rest (remembered for this visit).
  const group = (d, rows) => {
    const lines = rows.map(x => ({ b: x.b, t: ownerWords(x.b, two(billStep(x.b)?.line || '')) })), n = new Map();
    for (const l of lines) n.set(l.t, (n.get(l.t) || 0) + 1);
    const own = lines.filter(l => !l.t || n.get(l.t) < 2), shared = [...n].filter(([t, k]) => t && k >= 2).map(([t]) => t);
    const parts = [['', own.map(l => billLineRow(l.b, { button: btnOf(l.b) }))], ...shared.map(t => [t, lines.filter(l => l.t === t).map(l => billLineRow(l.b, { line: '', button: btnOf(l.b) }))])].filter(([, r]) => r.length);
    const mk = `${key}|${d}`, all = lines.length <= FOLD + 2 || S.coMore?.has(mk);
    let left = all ? Infinity : FOLD, out = '';
    for (const [t, r] of parts) { if (left <= 0) break; const shown = r.slice(0, left); left -= shown.length;
      out += `${t ? `<h3 class="i6-sub">${nw(esc(cap(t.replace(/\bthe chair\b/, 'the chairs'))))}</h3>` : ''}${box(shown.join(''))}`; }
    return out + (all ? '' : showAllBtn(lines.length, { 'data-comore': mk }));
  };
  return [...by].sort(([p], [q]) => p.localeCompare(q)).map(([d, g], i) => sec(`co6-n-${esc(key)}-${i}`, `${g.risk ? 'At risk: needs' : 'Needs'} a hearing by ${esc(dayWords(d))}`,
    group(d, g.rows), { more: i === by.size - 1 ? `<p class="i6-more-link"><a href="#/hearings/ask">Ask on ${ASK_TAB}${icon('chevron-right')}</a></p>` : '' })).join('');
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
export function standWeekHTML(bills, { key = '', from = '', after = '', byBill = false, take = false } = {}) {
  if (SESSION_OVER) return after;
  return `${hearingsSec(bills, { key, from, byBill })}${needsSecs(key, waitingOfBills(bills), { take })}${after}`;
}
// "Show all" in those sections, for a page that is not this one (the coalition page wires its own below).
export function wireWeek(root, redraw = () => hooks.render()) {
  root.querySelectorAll('[data-comore]').forEach(el => el.onclick = () => { (S.coMore ??= new Set()).add(el.dataset.comore); redraw(); });
}
// Live bills with no owner yet, each with Take it (F158); those that need a hearing are already in that list, with their
// Take it there (a bill shows once on a page, the critic). Giving one to someone else is on the bill (its owner picker).
const takeBtn = b => btn('Take it', { kind: 'secondary', sm: true, attrs: { 'data-cotakebill': b.id, 'aria-label': `Take ${billWords(b)}: you become its owner` } });
function unownedHTML(c, list) {
  const rows = list.map(b => billLineRow(b, { button: takeBtn(b) }));
  return sec('co6-s3', 'Bills with no owner yet', folded(c.id + '|o', rows));
}
// To-dos on its bills with nobody on them ("Anyone" on the bill page). Taking one is yours to do, so nobody is messaged
// (064 only tells a person when someone ELSE gives them a to-do). Past its date is said in words, not red (D3: red is only
// a step of yours overdue, and this one is nobody's yet).
function todosHTML(c, list) {
  const today = hiToday();
  const rows = list.map(({ t, b }) => {
    const due = !t.due_date ? '' : t.due_date < today ? `was due ${dayWords(t.due_date)}` : t.due_date === today ? 'due today' : `due ${dayWords(t.due_date)}`;
    return itemRow({ key: `${b.id}|${t.id}`, name: t.title, line: [`${nameWords(b, 1e4)} (${numNb(b)})`, due].filter(Boolean).map(x => nw(esc(x))).join(' · '), href: billRoute(b), cls: 'i6-row',
      button: btn('Take it', { kind: 'secondary', sm: true, attrs: { 'data-cotake': `${b.id}|${t.id}`, 'aria-label': `Take “${t.title}” on ${billWords(b)}` } }) });
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
function supportHTML(c, { slot = false } = {}) {
  if (!S.me || c.owner_id === S.me.id) return '';
  const v = pref(), on = supports(c);
  // R-277 fix 21 (W-8): "I support CTFH" read as a position on tobacco. The switch says what it is (you help on it) and
  // what it does (its work shows on your Today); "Monitor" stays a position only.
  const help = `Its hearings and deadlines show on your Today, never in its count.${v === 'all' ? ' You help on every coalition.' : ''}`;
  return `<section class="co6-card co6-sup${slot ? ' co6-slot' : ''}" aria-label="Your help">${switchRow('co-sup', `I help on ${esc(c.name)}`, on, esc(help))}</section>`;
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
      <ul>${iss.map(i => `<li><a href="${esc(`${PUBLIC_APP()}#/issue/${encodeURIComponent(i.slug)}`)}" target="_blank" rel="noopener">${issueTile(i, 'xs')}<span>${esc(i.name)}</span>${newTab}</a></li>`).join('')}</ul></details>` : ''}
  </section>`;
}

function pageHTML(c) {
  const back = `<a class="co6-back" href="#/issues/coalitions" data-back>${icon('chevron-left')}<span>Coalitions</span></a>`;
  const todos = openTodosOf(c), bills = billsOf(c), allUnowned = unownedOf(c);
  const needing = SESSION_OVER ? new Set() : new Set(needsOf(waitingOfBills(bills)).map(x => x.b.id)), unowned = allUnowned.filter(b => !needing.has(b.id));
  const anyTodo = bills.some(b => (S.todos[b.id] || []).some(t => !t.done));
  const clear = !allUnowned.length && !anyTodo ? [liveOf(c).length ? 'every live bill has an owner' : '', 'no open to-dos'].filter(Boolean) : [];
  const lead = standLeadHTML(bills, { clear });
  const week = standWeekHTML(bills, { key: c.id, from: c.id, take: true, after: `${unowned.length ? unownedHTML(c, unowned) : ''}${todos.length ? todosHTML(c, todos) : ''}` });
  // The partner update is the weekly job of the coalition's own people: one tonal button under the lead (one door,
  // Outreach › Partner update, B-13). Anyone else gets the I help switch in that place, the page's one useful act for them.
  const mine = mayUpdate(c);
  const act = mine ? `<p class="co6-acts">${btn('Write a partner update', { kind: 'secondary', icon: 'mail', href: memoHref(c) })}</p>` : supportHTML(c, { slot: true });
  const side = `${mine ? supportHTML(c) : ''}${shareHTML(c)}`;
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
  toast(`You own ${billWords(b)} now.`, { ok: true, undo: async () => { await DB.setOwner(b.id, was[0] || null); redrawKeep(); } });
}
export { takeBill };
async function takeTodo(key) {
  const [bid, tid] = key.split('|'), b = S.bills.find(x => String(x.id) === bid), t = (S.todos[bid] || []).find(x => String(x.id) === tid);
  if (!b || !t || !S.me) return;
  try { await DB.updateTodo(b.id, t.id, { assignee_id: S.me.id }); } catch (e) { toast(e, { err: true }); return; }
  redrawKeep();
  toast(`It’s yours: “${t.title}” on ${billWords(b)}.`, { ok: true, undo: async () => { await DB.updateTodo(b.id, t.id, { assignee_id: null }); redrawKeep(); } });
}

export default {
  tab: 'myissues',   // the second tab of My issues
  // One coalition is two columns from 1100px, which need more than the reading column.
  wide: route => !!route.id && DESK(),
  title: route => route.id ? coalById(route.id)?.name || 'Coalition' : 'Issues · Coalitions',
  back: route => route.id ? { href: '#/issues/coalitions', label: 'Coalitions' } : null,
  render(route) {
    if (!route.id) return indexHTML();
    const c = coalById(route.id);
    // Never a dead end (B-3): a coalition an admin removed, or a link from another setup.
    if (!c) return `<div class="co6-page">${empty({ h: 'h1', title: 'We could not find that coalition', text: 'It may have been removed or renamed in Session setup.', action: btn('See all coalitions', { kind: 'secondary', href: '#/issues/coalitions' }) })}</div>`;
    return pageHTML(c);
  },
  wire(route, app) {
    if (!route.id) { wireHelpBtns(app); restoreCard(app); return; }
    const c = coalById(route.id), root = app.querySelector('.co6-page'); if (!c || !root) return;
    rememberRow(c.id);
    const sw = root.querySelector('#co-sup'); if (sw) sw.onchange = () => setSupport(c, sw.checked);
    root.querySelectorAll('[data-cocopy]').forEach(el => el.onclick = () => el.dataset.cocopy === 'link'
      ? copyText(publicLink(c), 'Link copied.', 'link') : copyText(embedCode(c), 'Website box code copied.', 'website box code'));
    root.querySelectorAll('[data-cotakebill]').forEach(el => el.onclick = () => { const b = billById(el.dataset.cotakebill); if (b) takeBill(b); });
    root.querySelectorAll('[data-cotake]').forEach(el => el.onclick = () => takeTodo(el.dataset.cotake));
    wireWeek(root, () => redrawKeep());
    root.querySelector('.co6-iss')?.addEventListener('toggle', e => { const s = (S.coIss ??= new Set()); if (e.currentTarget.open) s.add(c.id); else s.delete(c.id); });
  },
};
