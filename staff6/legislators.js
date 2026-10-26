// Staff v6 · Legislators (#/legislators; R-336 spec 3.3 and 6, V23; F139-F144, F150). Three page tabs, each with its own
// address, and one find box on every tab (F143):
//   Who to ask (#/legislators, ?view=ask): the Get hearings board, the same component as Hearings > Get hearings (push.js
//     askBoard, drawn here since the integration: one board, so the two doors never disagree, X7; holding.js's own board
//     below is kept only as the fallback should askBoard fail). Mine · My coalitions · Team is a visible switch, the same as Hearings'.
//     Each chair carries ONE email button: the viewer's own asks with them, to them alone, named by bill (V24).
//   Everyone (?view=everyone): the directory as a grid of photo cards, both chambers or one (an All | House | Senate
//     switch, All first, remembered per person), grouped by island, A to Z or by committee (Sort); each card a photo, the
//     name, the district, its main towns and one line of what they hold of ours. With the "Hearing our bills this week" preset (F142, v5's This week view) and
//     the Filter sheet (island, committee, and Cares about on the practice copy, R-335). j and k walk the cards. Between
//     sessions #/legislators opens here (P10).
//   Holding our bills (?view=holding): the compact view of the same board, one row per chair (holding.js, F139, F141),
//     with the same switch, words and button rule as Who to ask.
// The find box looks at everyone, whatever the tab: a name, a town, a district ("HD 20", "sd5"), a committee ("HLT"), with
// or without the ʻokina and macrons; a street address looks up its districts on the live app (rule 3: the address is never
// kept, only the districts it finds). The tab comes from the address (route.view): v5's ?view=all|hold|week still open
// Everyone, Holding and Everyone's this-week preset.
import { S, DB, esc, DEMO, islandOf, SESSION_OVER } from './data.js';
import { plain, codesOf, geoSuggest, geoDistricts, ISLANDS, chairIdsOf, stopOf, diedish, legById } from './model.js';
import { icon, btn, iconBtn, empty, toast, segmented, pickerSheet, menuSheet, keysOn, filterBtn, sectionNav, andWords } from './ui.js';
import { HOLDING, holdingHTML, contactWords, lastContact, ensureContacts, chairRole, chairEmail, replyBtn, chairGroups, askItems, askScopes, askScope, scopeWhose } from './holding.js';
import * as PUSH from './push.js';   // Hearings > Get hearings' board (askBoard), drawn here (spec 6: one component)
import { photo, legName, legHref, seatsOf, roleWord, RANK, wireLinks, surname } from './pathway.js';
import { PROFILES, caresIds, caresCounts, issueSheet } from './profile.js';   // R-335 (practice copy)
import { issueById } from './issues.js';
import { billStep, billRow, committeeName, nw } from './steps.js';

const WEEK = 7 * 864e5;
const PARTY = { D: 'Democrat', R: 'Republican', I: 'Independent' };
const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;
// A menu closes itself with history.back(); a sheet opened before that Back lands would have its entry undone by it.
const afterBack = () => new Promise(res => { if (!history.state?.sheet) return res(); let done = false; const run = () => { if (done) return; done = true; removeEventListener('popstate', run); res(); }; addEventListener('popstate', run); setTimeout(run, 500); });

// ---- data (exports kept: search.js, conversation.js, profile.js and legislator.js import them) ----
// Our bills = tracked, with a position (not Monitor), the same set the current app's profile counts.
export const ourBill = b => b.tracked !== false && !!b.position && b.position !== 'monitor';
// Who hears our bills in the next 7 days: legislator id -> { bills: Set(bill id), roles: { code: role }, when: Map(bill id
// -> first hearing), hid: Map(bill id -> that hearing's id) }.
export function weekIndex() {
  const now = Date.now(), ours = new Set(S.bills.filter(ourBill).map(b => b.id)), out = new Map();
  for (const h of S.hearings) {
    if (h.status === 'cancelled' || !ours.has(h.bill_id)) continue;
    const t = new Date(h.scheduled_at).getTime(); if (t <= now || t - now > WEEK) continue;
    const cs = codesOf(h.committee);
    for (const m of S.committeeMembers || []) {
      if (!cs.includes(m.committee)) continue;
      const x = out.get(m.legislator_id) || { bills: new Set(), roles: {}, when: new Map(), hid: new Map(), byCm: new Map() };
      x.bills.add(h.bill_id); x.roles[m.committee] = m.role;
      if (!x.byCm.has(m.committee)) x.byCm.set(m.committee, new Set()); x.byCm.get(m.committee).add(h.bill_id);   // which committee hears which bill
      if (t < (x.when.get(h.bill_id) ?? Infinity)) { x.when.set(h.bill_id, t); x.hid.set(h.bill_id, h.id); }
      out.set(m.legislator_id, x);
    }
  }
  return out;
}
// Hawaiʻi numbers its districts island by island, so the island follows from the district. Senate: islandOf() in the
// data layer (the same rule Supporters uses). House, on the 2022 lines: 1 to 8 Hawaiʻi Island, 9 to 14 Maui County
// (13 takes in Molokaʻi and Lānaʻi), 15 to 17 Kauaʻi and Niʻihau, 18 to 51 Oʻahu.
const houseIsland = d => d >= 1 && d <= 8 ? 'Hawaiʻi' : d <= 14 ? 'Maui' : d <= 17 ? 'Kauaʻi' : d <= 51 ? 'Oʻahu' : null;
export const islandFor = l => (l.chamber === 'S' ? islandOf(l.district) : houseIsland(l.district)) || '';
const byDistrict = (a, b) => a.chamber.localeCompare(b.chamber) || a.district - b.district;
export const districtQ = k => /^(s|sd|sen|senate|h|hd|rep|house)?\s*(?:district)?\s*(\d{1,2})$/.exec(k);
const committeeOf = q => { const c = S.committees?.[String(q || '').trim().toUpperCase()]; return c || null; };
// Everything a legislator can be found by, plain (no ʻokina, no macrons, lower case): committee names in v6's words too.
const hayCache = new Map();
const hay = l => { let h = hayCache.get(l.id); if (h) return h;
  h = plain(`${l.name} ${l.sort_name} ${l.places || ''} ${l.chamber === 'S' ? 'senate senator sen' : 'house representative rep'} district ${l.district} ${islandFor(l)} ${l.party ? PARTY[l.party] || l.party : ''} ${l.title || ''} ${seatsOf(l).map(m => `${m.committee} ${S.committees?.[m.committee]?.name || ''} ${committeeName(m.committee)}`).join(' ')}`);
  hayCache.set(l.id, h); return h; };
// The text search: a district ("HD 20", "sd5", "20"), a committee code (members, chair first), or words in any order.
// A name, or a town matched whole, comes before a town matched inside a longer one: "Kailua" finds the Oʻahu Kailua's
// representatives before Kailua-Kona's (a hyphen joins a name, so Kailua-Kona is not Kailua).
export function matchLegs(q) {
  const k = plain(q).trim(), legs = S.legislators || []; if (!k) return [];
  const dm = districtQ(k);
  if (dm) { const n = +dm[2], ch = dm[1] ? (dm[1][0] === 's' ? 'S' : 'H') : ''; return legs.filter(l => l.district === n && (!ch || l.chamber === ch)).sort(byDistrict); }
  const c = committeeOf(q); if (c) return committeeLegs(c.code);
  const terms = k.split(/\s+/);
  const whole = l => terms.some(t => plain(l.name).includes(t) || placesOf(l).some(p => new RegExp(`(^|[^a-z-])${escRe(t)}([^a-z-]|$)`).test(plain(p))));
  return legs.filter(l => terms.every(t => hay(l).includes(t))).map(l => [l, whole(l) ? 0 : 1]).sort((a, b) => a[1] - b[1] || byDistrict(a[0], b[0])).map(x => x[0]);
}
// The towns of a legislator's district that the words typed name ("Kailua", "Kailua-Kona"), for the row's line.
const townHits = (l, q) => { const ts = plain(q || '').trim().split(/\s+/).filter(t => t.length >= 3); return ts.length ? placesOf(l).filter(p => ts.some(t => plain(p).includes(t))) : []; };
const committeeLegs = code => (S.committeeMembers || []).filter(m => m.committee === code).sort((a, b) => RANK[a.role] - RANK[b.role])
  .map(m => (S.legislators || []).find(l => l.id === m.legislator_id)).filter(Boolean);
// the places a district covers, one name each ("portion of Hilo" -> "Hilo")
const placesOf = l => (l.places || '').split(/,\s*/).map(x => x.replace(/^(and\s+)?(a\s+)?portions?\s+of\s+/i, '').replace(/^and\s+/i, '').trim()).filter(Boolean);
const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Street addresses look like "75-5722 Kuakini Hwy": a number and a word, and not a district.
const addressish = q => { const t = q.trim(); return t.length >= 5 && /\d/.test(t) && /[a-z]/i.test(t) && !districtQ(plain(t)); };
// The towns an address names ("… Kailua-Kona" finds Kailua-Kona; a hyphen joins a name, so it is not Kailua).
function townsIn(q) {
  const k = plain(q), out = new Map();
  for (const l of S.legislators || []) for (const pl of placesOf(l)) {
    const p = plain(pl);
    if (p.length >= 4 && k.length > p.length + 3 && new RegExp(`(^|[^a-z-])${escRe(p)}([^a-z-]|$)`).test(k)) { const x = out.get(p) || { label: pl, ids: [] }; if (!x.ids.includes(l.id)) x.ids.push(l.id); out.set(p, x); }
  }
  return [...out.values()].sort((a, b) => a.label.localeCompare(b.label));
}

// ---- v5's rows, kept for search.js (HELP) until it draws the v6 row ----
const PD = l => `${l.party ? l.party + '-' : ''}${l.chamber === 'S' ? 'SD' : 'HD'} ${l.district}`;
const pdHTML = l => `<span class="lg-pd"><span aria-hidden="true">${esc(PD(l))}</span><span class="sr">${esc(`${PARTY[l.party] || ''} ${l.chamber === 'S' ? 'Senate' : 'House'} District ${l.district}`.trim())}</span></span>`;
const townsHTML = l => { const t = String(l.places || '').trim(); if (!t) return '';
  return `<span class="lg-twn" title="${esc(t)}"><span aria-hidden="true">${esc(t)}</span><span class="sr">Covers ${esc(t)}</span></span>`; };
const andList = xs => xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;
const rolesText = roles => { const by = r => Object.entries(roles).filter(([, x]) => x === r).map(([c]) => c);
  const lead = ['chair', 'vice_chair'].filter(r => by(r).length).map(r => `${roleWord(r)}, ${andList(by(r))}`);
  return lead.length ? lead.join(' · ') : by('member').length ? `Member, ${andList(by('member'))}` : ''; };
export function stanceSummary(l, only) {
  let yes = 0, no = 0;
  for (const x of S.stances || []) { if (x.legislator_id !== l.id || (only && !only.has(x.bill_id))) continue; if (x.stance === 'yes' || x.stance === 'leaning_yes') yes++; else if (x.stance === 'no' || x.stance === 'leaning_no') no++; }
  if (!yes && !no) return '';
  const words = [yes ? `For ${yes} of our bills` : '', no ? `${yes ? 'against' : 'Against'} ${no}` : ''].filter(Boolean).join(', ');
  return `<span class="lg-ss" title="${words}"><span class="sr">${words}</span>${yes ? `<span aria-hidden="true">${icon('thumbs-up')}${yes}</span>` : ''}${no ? `<span aria-hidden="true">${icon('thumbs-down')}${no}</span>` : ''}</span>`;
}
export function legRow(l, { week, weekMode = false } = {}) {
  const w = week && week.get(l.id), n = w ? w.bills.size : 0;
  const sub = weekMode && w ? [`${n} of our bills`, rolesText(w.roles)]
    : [n ? `${n} of our bills this week` : '', l.title, seatsOf(l).map(m => m.role === 'member' ? m.committee : `${roleWord(m.role)}, ${m.committee}`).join(' · ')];
  return `<a class="row lg-row" href="${legHref(l)}">${photo(l, 40)}<span class="body"><span class="title"><span class="lg-nm">${esc(l.name)}</span>${pdHTML(l)}</span>${sub.filter(Boolean).length ? `<span class="sub">${esc(sub.filter(Boolean).join(' · '))}</span>` : ''}${townsHTML(l)}</span><span class="end">${stanceSummary(l, weekMode && w ? w.bills : null)}${icon('chevron-right', { cls: 'chev' })}</span></a>`;
}

// ---- state ----
// One state for every tab, kept for the visit (Back from a legislator finds the list as it was).
const view = () => (S.lg6 ??= { ask: '', week: false, ch: '', island: '', cmte: '', cares: '', sort: '', q: '', pick: null, addr: null, last: null });
// The tab from the address. #/legislators is Who to ask in session and Everyone between sessions (P10).
function tabOf(route) {
  const w = String(route?.view || route?.q?.view || '').toLowerCase();
  if (w === 'everyone' || w === 'all') return 'everyone';
  if (w === 'week') return 'everyone';           // v5's This week: Everyone with its preset
  if ((w === 'holding' || w === 'hold') && HOLDING()) return 'holding';
  if (w === 'ask') return 'ask';
  return SESSION_OVER ? 'everyone' : 'ask';
}
// Arriving at an address applies what it asks for once (a later redraw never undoes what the person picked since).
let arrived = '';
function arrive(route, v) {
  if (location.hash === arrived) return; arrived = location.hash;
  // A new arrival (a tab, a link) starts without the last search; Back finds the list as it was left.
  if (performance.now() - poppedAt > 1000) { v.q = ''; v.pick = null; }
  const w = String(route?.view || '').toLowerCase();
  if (w === 'week') v.week = true;
  if (w === 'everyone' || w === 'all') v.week = false;
  const ch = chOfWord(route?.q?.ch); if (ch) v.ch = ch;   // a link may name the chamber (?ch=house); the pick is not saved
}
const caresOn = v => PROFILES() && !!v.cares;
const caresName = v => issueById(v.cares)?.name || 'that issue';
const searching = v => !!(v.q.trim() || v.pick);

// ---- Who to ask: the Get hearings board (V13, V23) ----
// Hearings > Get hearings' own board (push.js askBoard) when it is there, so the two places are one component and can never
// disagree (spec 6, X7). Until then the same board grouped by chair from the same model (holding.js chairGroups): each
// chair a section heading (22px, its role and last contact under it) with its ONE email button, the viewer's own asks with
// that chair (new ones and follow-ups), to that chair alone and named by bill (V24); under it our bills in the shared row,
// each line said of that chair (chairLine). A bill's one button: "They replied" on the viewer's own ask that waits for a
// reply (that chair's answer only), or Take it on an ask nobody holds, for whoever may hand it.
function askRowBtn(x, l) {
  if (x.waitingMine) return replyBtn(x.b, l, x.aw.code);
  if (x.s?.key === 'ask' && !x.s.other) { const st = billStep(x.b); if (st?.kind === 'chair' && st.nobody && st.takeFor) return btn('Take it', { kind: 'secondary', sm: true, attrs: { 'data-v6act': 'take', 'data-v6b': x.b.id } }); }
  return false;
}
function groupHTML(g) {
  const l = g.l, act = chairEmail(l, g.rows), hid = `lg6-g${l.id}`;
  const line = [chairRole(l, g.rows.map(x => x.aw.code)), contactWords(l)].filter(Boolean).join(' · ');
  return `<section class="lg6-grp" aria-labelledby="${hid}">
    <div class="lg6-gh"><div class="lg6-gt"><h2 class="lg6-gname" id="${hid}"><a class="lg6-gn" href="#/legislator/${l.id}?from=ask">${esc(legName(l))}</a></h2><p class="lg6-gline">${nw(esc(line))}</p></div>${act ? `<span class="lg6-gact">${act}</span>` : ''}</div>
    <div class="lg6-rows" role="list" aria-label="${esc(`Our bills with ${legName(l)}`)}">${g.rows.map(x => billRow(x.b, { line: nw(esc(x.line)), button: askRowBtn(x, l), cls: 'lg6-wrap' })).join('')}</div>
  </section>`;
}
function askHTML(v) {
  if (SESSION_OVER) return empty({ title: 'No asks between sessions', text: 'Asking chairs for hearings starts when the session opens in January.', action: btn('See everyone', { kind: 'secondary', href: '#/legislators?view=everyone' }) });
  const scope = askScope(v.ask);
  if (typeof PUSH.askBoard === 'function') { try { return PUSH.askBoard({ scope, primary: true, id: 'lg', fold: true }); } catch (e) { console.warn('askBoard', e); } }
  const { items, scheduled: n } = askItems(scope), whose = scopeWhose(scope);
  const heard = n ? `<p class="lg6-foot">${icon('calendar-check')}<span>${esc(`${n} of ${whose} ${n === 1 ? 'has' : 'have'} a hearing set.`)} <a href="#/hearings">See Hearings</a></span></p>` : '';
  if (!items.length) return empty({ title: `None of ${whose} is waiting for a hearing`, text: 'When one is referred to a committee, its chair shows here with the day to ask by.', action: btn('See everyone', { kind: 'secondary', href: '#/legislators?view=everyone' }) }) + heard;
  const gs = chairGroups(items), bills = new Set(items.map(x => x.b.id)).size;
  return `<p class="lg6-sum">${esc(`${plural(gs.length, 'chair')} to ask about ${plural(bills, 'bill')}, the soonest ask first.`)}</p>
    <div class="lg6-board">${gs.map(groupHTML).join('')}</div>${heard}`;
}

// ---- Everyone: the directory as a grid of faces (F142, F144; R-336 walk 2, Nate: "can this be better organized? Profile
// pictures, easy to identify. Not one big long list?") ----
// Both chambers or one (the All | House | Senate switch, All first, remembered per person), grouped by island (Hawaiʻi
// Island, Maui County, Kauaʻi, Oʻahu, Nate's order), A to Z under a heading for each letter, or by
// committee (the chair first, then the vice chair, then members; a legislator appears under each committee they sit on),
// with a row of jump chips, one per group, over them.
// Each card is one link: a large photo, the name, the district (and the island, unless the group's heading already says
// it, A-14), and ONE line of what they hold of ours, blank when nothing (C-14 on v6). The switch replaces the Filter
// sheet's Chamber choice, and the three sorts replace the six (A-25): nothing is added to the screen but the switch.
// The line on a card, one shape with numerals (critic, R-336 walk 2): this week's hearings first, then the bills waiting on
// them as chair, then our bills in their committees. [words, strong]: a chair holding our bills is the line that asks for
// something, so it alone is set in bold (weight only, no colour: nothing is late, A-5 on v6).
function cardLine(l, week) {
  const w = week.get(l.id);
  // "Chairs a committee hearing 2 of our bills" was said of Rep. Takayama, who chairs House Health while one of the two
  // was heard in Judiciary, where he is a member: he chairs the hearings only when every one of those bills is in his own.
  if (w) { const chaired = Object.entries(w.roles).filter(([, r]) => r === 'chair').map(([c]) => c), n = w.bills.size;
    const inChaired = new Set(chaired.flatMap(c => [...(w.byCm?.get(c) || [])]));
    return [chaired.length && inChaired.size === n ? (n === 1 ? 'Chairs the hearing on 1 of our bills this week' : `Chairs hearings on ${n} of our bills this week`) : `Hearing ${n} of our bills this week`, false]; }
  const seats = seatsOf(l).map(m => m.committee), chairs = seatsOf(l).filter(m => m.role === 'chair').map(m => m.committee);
  let hold = 0, inCm = 0;
  for (const b of S.bills) { if (!ourBill(b) || diedish(b)) continue; const st = stopOf(b); if (st.phase !== 'committee' || !st.committee) continue;
    const cs = codesOf(st.committee); if (cs.some(c => seats.includes(c))) { inCm++; if (st.column === 'a' && cs.some(c => chairs.includes(c))) hold++; } }
  if (hold) return [`Chair: ${hold} of our bills ${hold === 1 ? 'waits' : 'wait'} on them`, true];
  if (inCm) return [`${inCm} of our bills in their committees`, false];
  return ['', false];
}
// Hawaiʻi has a Kailua on Oʻahu and a Kailua-Kona on Hawaiʻi Island, so the island tells two towns apart (F143).
const islandWords = l => { const i = islandFor(l); return i === 'Hawaiʻi' ? 'Hawaiʻi Island' : i === 'Maui' ? 'Maui County' : i; };
// Nate's order (R-336 walk 3: "Kauai should be listed between Maui and Oahu"): the neighbour islands south-east to
// north-west, then Oʻahu, the biggest group, last.
const ISLAND_ORDER = ['Hawaiʻi', 'Maui', 'Kauaʻi', 'Oʻahu'];
// The district's main towns for the card (R-336 walk 3, Nate: "The main neighborhoods should be listed on each legislators
// card"): the first three the Capitol lists, each whole ("Portions of Keaʻau and Kurtistown" is two towns), a name too long
// for a phone card's line left out rather than cut. Typed with the Capitol's ‘ or ' for the ʻokina; shown with the ʻokina.
const okina = t => t.replace(/(^|[\s\p{L}])['‘’](?=\p{L})/gu, '$1ʻ');
const PORTION = /^(a\s+)?portions?\s+of\s+/i;
const townsOf = l => String(l.places || '').split(/,\s*/).flatMap(x => { const t = x.trim().replace(/^and\s+/i, '');
  return PORTION.test(t) ? t.replace(PORTION, '').split(/\s+and\s+/) : [t]; }).map(x => okina(x.trim())).filter(Boolean);
// About what one name may take: a 390 phone's card holds 16 characters a line, a laptop's about 22.
const townMax = () => narrow() ? 16 : 22;
function townLine(l, q = '') {
  const all = [...new Set(townsOf(l))]; if (!all.length) return '';
  // A search that named a town puts it first ("Kailua"), so the card says why it was found.
  const hits = q ? new Set(townHits(l, q).map(okina)) : new Set();
  const order = [...all.filter(t => hits.has(t)), ...all.filter(t => !hits.has(t))];
  const pick = order.filter(t => t.length <= townMax() || hits.has(t)).slice(0, 3);
  const shown = pick.length ? pick : order.slice(0, 1);
  // One line: each name is kept whole (no wrap inside it) and the line may break only between names (a zero-width space);
  // a name that would start a second line is hidden by the line's height (legislators.css .lg6-ctw), so a narrow card shows
  // two and a wide one three, never a name cut in half. It stays one run of text, one fact on the card. The full list is
  // the title; a screen reader hears the names offered.
  return `<span class="lg6-ctown" title="${esc(okina(String(l.places || '').trim()))}"><span class="sr">Covers ${esc(andList(shown))}. </span><span class="lg6-ctw" aria-hidden="true">${shown.map((t, i) => `<span>${i ? ', ' : ''}${esc(t)}</span>`).join('&#8203;')}</span></span>`;
}
// The card's face: the photo over its initial. The initial is drawn by CSS (legislators.css .lg6-rph::before) rather than as
// text, so the card still reads as its name, district and one line; a photo that fails to load removes itself and the
// initial shows (no broken image).
const face = l => `<span class="lg6-rph lg6-cph" aria-hidden="true" data-i="${esc((l.name || '?')[0])}">${l.photo_url ? `<img class="lg-ph" src="${esc(l.photo_url)}" alt="" loading="lazy" decoding="async" onerror="this.remove()">` : ''}</span>`;
// One card. `place`: the district line (the island left out under an island heading); the district's main towns (the
// towns a search matched first); `line`: what they hold of ours; `full`: the name with Rep. or Sen., for a list that mixes
// the chambers (All, search results); `brk`: the first representative under an island in All starts a new row.
function personCard(l, week, { from = '', q = '', place = null, line = null, full = false, letter = '', brk = false } = {}) {
  const [ln, strong] = line != null ? [line, false] : cardLine(l, week);
  const dist = place ?? [`District ${l.district}`, islandWords(l)].filter(Boolean).join(' · ');
  const name = full ? legName(l) : l.name;
  // A to Z: the first card of each letter carries the letter as a small badge in its corner and is the letter chip's target.
  return `<div class="lg6-cell${brk ? ' lg6-brk' : ''}" role="listitem" data-lgrow="${l.id}"${letter ? ` id="lg6-g-${letter}"` : ''}><a class="lg6-card" href="${legHref(l)}${from ? `?from=${from}` : ''}" data-lglink="${l.id}">${letter ? `<span class="lg6-badge" aria-hidden="true">${esc(letter)}</span>` : ''}${face(l)}<span class="lg6-cname">${esc(name)}</span><span class="lg6-cdist">${nw(esc(dist))}</span>${townLine(l, q)}${ln ? `<span class="lg6-cline${strong ? ' strong' : ''}">${esc(ln)}</span>` : ''}</a></div>`;
}
const grid = (inner, label, cls = '') => `<div class="lg6-grid${cls ? ' ' + cls : ''}" role="list" aria-label="${esc(label)}">${inner}</div>`;
const cards = (ls, week, opts = {}) => ls.map(l => personCard(l, week, opts)).join('');
// A group: its heading (22px, its count beside it in plain words when it helps), a target for its jump chip; and its grid.
const groupOf = g => `<section class="lg6-sec6" aria-labelledby="${g.id}"><div class="lg6-sh"><h2 id="${g.id}" tabindex="-1">${esc(g.title)}</h2>${g.count ? `<span class="lg6-sn">${esc(g.count)}</span>` : ''}</div>${grid(g.inner, g.title)}</section>`;
// ---- All | House | Senate: from the address (?ch=all|house|senate), else the person's last pick, else All ----
// All is the default (R-336 walk 3, Nate: "The page should default to \"all legislators\", and could be changes to just
// house or just senate"); a House or Senate pick saved before keeps being honoured. The pick is saved in the person's
// settings (prefs.lgch) and this browser, as Hearings' switches are (B-6). 'A' stands for All.
const CHKEY = () => `hiphi6_lgch_${S.me?.id || ''}`;
const chSaved = () => { try { return localStorage.getItem(CHKEY()) || ''; } catch { return ''; } };
async function rememberCh(ch) {
  try { localStorage.setItem(CHKEY(), ch); } catch { /* a private window: this visit only */ }
  try { await DB.patchPrefs({ lgch: ch }); } catch { /* kept for this visit */ }
}
const chOfWord = x => { const k = String(x || '').toLowerCase(); return k === 'h' || k === 'house' ? 'H' : k === 's' || k === 'senate' ? 'S' : k === 'a' || k === 'all' ? 'A' : ''; };
const chamberOf = v => v.ch || (v.ch = [S.me?.prefs?.lgch, chSaved()].map(chOfWord).find(Boolean) || 'A');
const chSwitch = v => segmented('lgch', [['A', 'All'], ['H', 'House'], ['S', 'Senate']], chamberOf(v), 'Chamber');
const whoOf = (ch, n) => ch === 'H' ? (n === 1 ? 'representative' : 'representatives') : ch === 'S' ? (n === 1 ? 'senator' : 'senators') : (n === 1 ? 'legislator' : 'legislators');
const inCh = (l, ch) => ch === 'A' || l.chamber === ch;
// Under an island in All: the senators first, then the representatives from a new row (see groupsOf).
const senFirst = (a, b) => (a.chamber === 'S' ? 0 : 1) - (b.chamber === 'S' ? 0 : 1) || a.district - b.district;

const SORTS = [['island', 'By island'], ['name', 'A to Z'], ['committee', 'By committee']];
const sortOf = v => SORTS.some(x => x[0] === v.sort) ? v.sort : 'island';
const sortWords = k => k === 'name' ? 'A to Z' : SORTS.find(x => x[0] === k)[1].toLowerCase();
const byName = (a, b) => plain(surname(a)).localeCompare(plain(surname(b))) || plain(a.name).localeCompare(plain(b.name));
const filtersN = v => [v.island, v.cmte, caresOn(v)].filter(Boolean).length;
// Everyone in the chosen chamber who passes the filters and the preset, in district order.
function everyoneList(v, week, ch = chamberOf(v)) {
  const keep = l => inCh(l, ch) && (!v.island || islandFor(l) === v.island) && (!v.cmte || seatsOf(l).some(m => m.committee === v.cmte));
  let ls = (S.legislators || []).filter(keep);
  if (caresOn(v)) { const ids = caresIds(v.cares); ls = ls.filter(l => ids.has(l.id)); }
  if (v.week) ls = ls.filter(l => week.has(l.id));
  return ls.sort(byDistrict);
}
// The groups for a sort, each { id, title, chip, n, count, inner }: islands in Nate's order, letters, or committees.
const shortCm = code => committeeName(code).replace(/^(House|Senate) /, '');
function groupsOf(v, ls, week, ch) {
  const key = sortOf(v), full = ch === 'A';   // All mixes the chambers: each card's name says Sen. or Rep.
  if (key === 'name') {
    const by = new Map();
    for (const l of ls.slice().sort(byName)) { const k = plain(surname(l))[0]?.toUpperCase() || '#'; if (!by.has(k)) by.set(k, []); by.get(k).push(l); }
    // One continuous grid (Nate's point: not a long list): the letters are chips and corner badges, not heading rows.
    return [...by].map(([k, g]) => ({ id: `lg6-g-${k}`, title: k, chip: k, count: '', flow: true, inner: g.map((l, i) => personCard(l, week, { letter: i ? '' : k, full })).join('') }));
  }
  if (key === 'committee') {
    const ids = new Set(ls.map(l => l.id));
    // In All, the House's committees and then the Senate's, each A to Z (their names begin "House " and "Senate ").
    const cms = Object.values(S.committees || {}).filter(c => inCh(c, ch) && (!v.cmte || c.code === v.cmte)).sort((a, b) => committeeName(a.code).localeCompare(committeeName(b.code)));
    return cms.map(c => {
      const ms = (S.committeeMembers || []).filter(m => m.committee === c.code && ids.has(m.legislator_id)).map(m => [m, legById(m.legislator_id)]).filter(([, l]) => l)
        .sort(([a, la], [b, lb]) => RANK[a.role] - RANK[b.role] || byName(la, lb));
      // The role takes the island's place on the chair's and vice chair's cards; a member's card reads as anywhere else.
      // In All a chip keeps the chamber: both have a Health committee.
      return ms.length ? { id: `lg6-g-${c.code}`, title: committeeName(c.code), chip: full ? committeeName(c.code) : shortCm(c.code), count: plural(ms.length, 'member'),
        inner: ms.map(([m, l]) => personCard(l, week, { full, place: m.role === 'member' ? null : `${roleWord(m.role)} · District ${l.district}` })).join('') } : null;
    }).filter(Boolean);
  }
  // In All, each island's senators first and then its representatives, the first of them starting a new row: calmer than
  // mixing them in district order, where Senate District 1 and House District 1 would sit side by side as two "District
  // 1" cards, and it needs no second heading. The island's count names both ("4 senators, 8 representatives").
  return ISLAND_ORDER.map(i => { const g = ls.filter(l => islandFor(l) === i); if (!g.length) return null;
    const t = i === 'Hawaiʻi' ? 'Hawaiʻi Island' : i === 'Maui' ? 'Maui County' : i;
    if (full) g.sort(senFirst);
    const nS = g.filter(l => l.chamber === 'S').length, nH = g.length - nS;
    const count = full ? [nS ? plural(nS, 'senator') : '', nH ? plural(nH, 'representative') : ''].filter(Boolean).join(', ') : plural(g.length, whoOf(ch, 1), whoOf(ch, 2));
    return { id: `lg6-g-${plain(i).replace(/[^a-z]/g, '')}`, title: t, chip: t, n: g.length, count,
      inner: g.map((l, k) => personCard(l, week, { full, place: `District ${l.district}`, brk: full && k > 0 && l.chamber === 'H' && g[k - 1].chamber === 'S' })).join('') };
  }).filter(Boolean);
}
// The jump chips: one per group, each scrolling to its heading (critic: three screens of one sort read as a long list
// again). They replace the caption sentence; what it said (the chamber, the count, the order) is the row's name for a
// screen reader and the short lead before the switch. One row that slides sideways on a phone, like the page tabs.
const jumpHTML = (gs, label) => gs.length < 2 ? '' : `<nav class="lg6-jump" aria-label="${esc(label)}"><div class="lg6-jrow">${gs.map(g =>
  `<button type="button" class="lg6-jchip" data-lgjump="${g.id}">${esc(g.chip)}${g.n ? ` <span class="lg6-jn">${g.n}</span>` : ''}</button>`).join('')}</div></nav>`;
function everyoneHTML(v) {
  const week = weekIndex(), ch = chamberOf(v), ls = everyoneList(v, week), all = (S.legislators || []).filter(l => inCh(l, ch)).length;
  const on = filtersN(v), who = whoOf(ch, ls.length), other = ch === 'H' ? 'S' : ch === 'S' ? 'H' : '';
  const bits = [v.island ? `from ${v.island === 'Hawaiʻi' ? 'Hawaiʻi Island' : v.island === 'Maui' ? 'Maui County' : v.island}` : '', v.cmte ? `on ${committeeName(v.cmte)}` : '', caresOn(v) ? `who care about ${caresName(v)}` : ''].filter(Boolean).join(' ');
  // With the preset on, the other chamber's count is said too, so a switch never hides who hears our bills (All shows both).
  const otherN = v.week && other ? everyoneList(v, week, other).length : 0;
  // The lead: who is shown, in a few words; the order is the chips' own name (and the Sort button's).
  const lead = v.week ? `${ls.length} ${who}${bits ? ' ' + bits : ''} ${ls.length === 1 ? 'hears' : 'hear'} our bills this week${otherN ? ` · ${otherN} ${whoOf(other, otherN)} too` : ''}`
    : ls.length === all && !on ? `All ${all} ${who}` : `${ls.length} ${who}${bits ? ' ' + bits : ''}`;
  const clear = on ? btn('Clear filters', { kind: 'text', sm: true, icon: 'x', attrs: { 'data-lgclear': 'filters' } }) : '';
  const head = body => `<div class="lg6-cap lg6-chcap">${chSwitch(v)}${body}</div>`;
  if (!ls.length) {
    const seeOther = otherN ? btn(`See the ${other === 'H' ? 'House' : 'Senate'}`, { kind: 'secondary', attrs: { 'data-seg': 'lgch', 'data-val': other } }) : '';
    if (v.week && !on) return head('') + empty({ title: `No ${whoOf(ch, 1)} hears our bills this week`, text: otherN ? `${otherN} ${whoOf(other, otherN)} ${otherN === 1 ? 'does' : 'do'}.` : 'Nothing is scheduled in the next 7 days.', action: seeOther || btn('See everyone', { kind: 'secondary', attrs: { 'data-lgweek': '0' } }) });
    if (caresOn(v) && on === 1) return head('') + empty({ title: `No ${whoOf(ch, 1)} cares about ${esc(caresName(v))} yet`, text: 'To add one, open a legislator’s page and add the issue under What they care about.', action: btn('Pick another issue', { kind: 'secondary', attrs: { 'data-lgcares': '1', 'aria-haspopup': 'dialog' } }) });
    return head('') + empty({ title: 'No one fits these filters', text: v.week ? `No ${whoOf(ch, 1)} with these filters hears our bills in the next 7 days.` : 'Try one filter fewer.', action: btn('Clear filters', { kind: 'secondary', attrs: { 'data-lgclear': 'filters' } }) });
  }
  const gs = groupsOf(v, ls, week, ch), order = sortWords(sortOf(v));
  // The lead shows only when something narrows the list; "All 77 legislators" is what the switch already says, so it is
  // the chip row's name for a screen reader instead, with the order (A-14). The chips sit beside the switch on a laptop.
  const nav = jumpHTML(gs, `${lead}, ${order}${sortOf(v) === 'committee' ? ', the chair first' : ''}: go to`);
  return `${head(`${on || v.week ? `<p class="lg6-lead">${esc(lead)}</p>${clear}` : ''}${nav}`)}${nav || on || v.week ? '' : `<p class="sr">${esc(lead)}, ${esc(order)}.</p>`}<div class="lg6-groups">${gs[0]?.flow ? grid(gs.map(g => g.inner).join(''), `${lead}, A to Z`) : gs.map(groupOf).join('')}</div>`;
}
// Who to ask's and Holding's switch: Mine · My coalitions · Team, the same choices as Hearings > Get hearings
// (holding.js askScopes), so the two tabs always show the same bills (X7).
function askTools(v) {
  if (SESSION_OVER) return '';
  const opts = askScopes(), scope = askScope(v.ask);
  return opts.length > 1 ? `<div class="lg6-tools">${segmented('lgask', opts, scope, 'Whose bills')}</div>` : '';
}
const toolsHTML = (tab, v) => searching(v) ? '' : tab === 'everyone' ? everyoneTools(v) : askTools(v);
// The directory's tools: the preset, Filter and Sort, in one row beside the find box, each the same tonal pill; the preset
// says it is on with a check and aria-pressed. Sort's label stays short (the caption names the order), so pressing the
// preset never pushes the row onto two lines. On a phone Filter sits beside the box, and the preset and Sort share the
// next line (Sort used to move into the Filter sheet below 400px, so a 390 iPhone never saw it: critic, R-336 walk 2).
const narrow = () => { try { return matchMedia('(max-width: 767px)').matches; } catch { return false; } };
// Between sessions nothing is heard, so the preset is left out (one control fewer on the first screen, A-2; the All
// choice of walk 3 took that place).
function everyoneTools(v) {
  const sort = sortWords(sortOf(v));
  return `<div class="lg6-tools lg6-etools" role="group" aria-label="Show">
    ${SESSION_OVER && !v.week ? '' : btn('Hearing our bills this week', { kind: 'secondary', sm: true, icon: v.week ? 'check' : 'calendar', cls: 'lg6-preset', attrs: { 'data-lgweek': v.week ? '0' : '1', 'aria-pressed': String(!!v.week) } })}
    ${filterBtn(filtersN(v), { 'data-lgfilter': '1' })}
    ${btn('Sort', { kind: 'secondary', sm: true, iconEnd: 'chevron-down', cls: 'lg6-sortb', attrs: { 'data-lgsort': '1', 'aria-haspopup': 'dialog', 'aria-label': `Sort, now ${sort}` } })}
  </div>`;
}

// ---- the find box (every tab, F143) ----
function searchHTML(v) {
  const q = v.q.trim(), week = weekIndex();
  const clear = btn('Clear', { kind: 'text', sm: true, icon: 'x', attrs: { 'data-lgclear': 'q' } });
  if (v.pick?.loading) return `<div class="lg6-cap"><p>${icon('map-pin')}<span>Finding the districts for ${esc(v.pick.label)}</span></p></div><div class="skel lg-skel"></div>`;
  if (v.pick) {
    const ls = v.pick.ids.map(id => legById(id)).filter(Boolean);
    const cap = `<div class="lg6-cap"><p>${icon(v.pick.kind === 'committee' ? 'users' : 'map-pin')}<span><b>${esc(v.pick.label)}</b> · ${esc(v.pick.note || plural(ls.length, 'legislator'))}</span></p>${clear}</div>`;
    return cap + (ls.length ? grid(cards(ls, week, { full: true }), 'Legislators') : empty({ title: 'No legislator found for that address', text: 'Check the street number and town, or try the town name alone.' }));
  }
  const ls = matchLegs(q), c = committeeOf(q);
  // A street address: the live app looks it up (address_suggest), the practice copy offers the towns it names.
  let addr = '';
  if (addressish(q)) {
    if (DEMO) { const towns = townsIn(q); v.towns = towns;
      addr = ls.length ? '' : `<p class="lg6-snote">${icon('info')}<span>The practice copy finds the town in an address, not the street number. The live app looks up the exact address.</span></p>${towns.length ? `<div class="lg6-chips" role="group" aria-label="Towns in that address">${towns.map((x, i) => `<button type="button" class="lg6-preset" data-lgplace="${i}">${icon('map-pin')}<span>${esc(x.label)}</span></button>`).join('')}</div>` : ''}`; }
    else if (v.addr && v.addr.q === q) addr = v.addr.results.length ? `<div class="lg6-chips" role="group" aria-label="Addresses">${v.addr.results.slice(0, 5).map((x, i) => `<button type="button" class="lg6-preset" data-lgaddr="${i}">${icon('house')}<span>${esc(x.label)}</span></button>`).join('')}</div>` : '';
    else addr = `<p class="lg6-snote" role="status">${icon('loader-circle', { cls: 'lg-spin' })}<span>Looking up the address</span></p>`;
  }
  if (!ls.length) return addr + (/data-lg(place|addr)=/.test(addr) ? '' : empty({ title: `No one matches “${esc(q)}”`, text: 'Try a last name, a town, a district number or a committee such as Health.', action: btn('Clear the search', { kind: 'secondary', attrs: { 'data-lgclear': 'q' } }) }));
  const cap = c ? `<b>${esc(committeeName(c.code))}</b> · ${plural(ls.length, 'member')}, the chair first` : `${ls.length} of ${(S.legislators || []).length} ${ls.length === 1 ? 'matches' : 'match'} “${esc(q)}”`;
  // Words in the box: the box's own X clears them (one clear control, not two).
  return `${addr}<div class="lg6-cap"><p>${icon(c ? 'users' : 'search')}<span>${cap}</span></p></div>${grid(cards(ls, week, { full: true, q: c ? '' : q }), 'Legislators found')}`;
}

function bodyHTML(tab, v) {
  if (searching(v)) return searchHTML(v);
  if (tab === 'holding') return holdingHTML({ scope: v.ask });
  if (tab === 'everyone') return everyoneHTML(v);
  return askHTML(v);
}
// The page tabs: sectionNav's row (ui.js). Who to ask carries ?view=ask, so it opens between sessions too, when the bare
// address opens Everyone (shared change asked of ui.js; until then it is put right here).
const navHTML = tab => sectionNav('legislators', tab, { hide: HOLDING() ? [] : ['holding'] }).replace('href="#/legislators"', 'href="#/legislators?view=ask"');

export default {
  tab: 'legislators', title: () => 'Legislators', wide: () => false,
  render(route) {
    const v = view(), tab = tabOf(route); arrive(route, v);
    const box = `<form class="lg6-find" role="search" data-lgform novalidate>
        <label class="sr" for="lg-q">Find a legislator by name, town, district, committee or street address</label>
        ${icon('search')}
        <input id="lg-q" class="input" type="search" enterkeyhint="search" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${narrow() ? 'Name, town or district' : 'Name, town, district or committee'}" value="${esc(v.q)}" aria-controls="lg-body">
        ${iconBtn('x', 'Clear the search', { 'data-lgclear': 'q', hidden: !v.q }, 'lg6-x')}
      </form>`;
    return `<div class="lg6" data-lgtab="${tab}">
      <div class="sv-phead lg6-head"><h1 class="sv-h1">Legislators</h1><span class="sv-phr">${navHTML(searching(v) ? '' : tab)}</span></div>
      <div class="lg6-bar">${box}${toolsHTML(tab, v)}</div>
      <p class="sr" role="status" id="lg-status"></p>
      <div id="lg-body">${bodyHTML(tab, v)}</div>
    </div>`;
  },
  wire(route, app) {
    const root = app.querySelector('.lg6'); if (!root) return;
    const v = view(), tab = root.dataset.lgtab, inp = root.querySelector('#lg-q'), form = root.querySelector('[data-lgform]'), body = root.querySelector('#lg-body');
    const x = form.querySelector('[data-lgclear]');
    // Repaint the list and the tools only: the box keeps its focus and caret.
    const paint = () => {
      if (!root.isConnected) return;
      const bar = root.querySelector('.lg6-bar'), tools = bar.querySelector('.lg6-tools'), el = document.activeElement;
      const keep = el?.closest?.('.lg6-tools') ? (el.dataset.seg ? `[data-seg="${el.dataset.seg}"][data-val="${el.dataset.val}"]` : `[${[...el.attributes].find(a => /^data-lg/.test(a.name))?.name}]`) : null;
      if (tools) tools.remove();
      bar.insertAdjacentHTML('beforeend', toolsHTML(tab, v));
      if (keep) bar.querySelector(`.lg6-tools ${keep}`)?.focus();
      body.innerHTML = bodyHTML(tab, v); x.hidden = !inp.value;
      // Search results are their own state: the find box searches everyone, so no tab stays underlined meanwhile (Kevin
      // searched from Who to ask and read directory results under Who to ask's underline).
      const phr = root.querySelector('.lg6-head .sv-phr'); if (phr) { const nav = navHTML(searching(v) ? '' : tab); if (phr.innerHTML !== nav) phr.innerHTML = nav; }
      const n = new Set([...body.querySelectorAll('[data-lgrow], .lg6-grp, [data-v6row^="hold-"]')].map((e, i) => e.dataset.lgrow || 'x' + i)).size;
      fadeJump();
      root.querySelector('#lg-status').textContent = searching(v) || tab === 'everyone' ? `${n} ${n === 1 ? 'legislator' : 'legislators'} listed` : '';
    };
    // The chip row slides sideways on a phone: its edge fades where more chips wait, as the page tabs' row does.
    const fadeJump = () => { const r = root.querySelector('.lg6-jrow'); if (!r) return;
      const set = () => { const over = r.scrollWidth > r.clientWidth + 1; r.classList.toggle('ovf', over); r.classList.toggle('atstart', r.scrollLeft <= 1); r.classList.toggle('atend', r.scrollLeft + r.clientWidth >= r.scrollWidth - 1); };
      set(); r.addEventListener('scroll', set, { passive: true }); };
    fadeJump();
    wireLinks(root);
    ensureContacts(() => { if (root.isConnected && !document.querySelector('dialog[open]')) paint(); });
    // Back from a legislator: the row you opened has the focus again, so j and k carry on from there.
    if (v.last && performance.now() - poppedAt < 1000) body.querySelector(`[data-lglink="${v.last}"]`)?.focus({ preventScroll: true });
    v.last = null;
    // Address suggestions come from the live tracker's table of Hawaiʻi street addresses. The practice copy never makes
    // that request (nothing may reach Supabase there), so it offers the towns the address names instead.
    const lookup = () => {
      clearTimeout(v.t); const q = v.q.trim();
      if (DEMO || !addressish(q) || (v.addr && v.addr.q === q)) return;
      v.t = setTimeout(async () => {
        let results = []; try { results = await geoSuggest(q); } catch { /* shown as no address rows */ }
        if (v.q.trim() === q) { v.addr = { q, results }; paint(); }
      }, 250);
    };
    const pickAddress = async a => {
      v.pick = { kind: 'address', label: a.label, loading: true }; v.q = ''; inp.value = ''; paint();
      try {
        const d = await geoDistricts(a);
        const ids = d.found ? (S.legislators || []).filter(l => (l.chamber === 'S' && l.district === d.senate) || (l.chamber === 'H' && l.district === d.house)).map(l => l.id) : [];
        v.pick = { kind: 'address', label: a.label, ids, note: d.found ? `Senate District ${d.senate}, House District ${d.house}` : 'no districts found' };
      } catch { v.pick = null; toast('Could not look up that address. Try again.', { err: true }); }
      paint();
    };
    inp.addEventListener('input', () => { v.q = inp.value; v.pick = null; paint(); lookup(); });
    inp.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { const f = body.querySelector('.v6-row-main, .lg6-card'); if (f) { e.preventDefault(); f.focus(); } }
      if (e.key === 'Escape' && inp.value) { e.preventDefault(); inp.value = ''; v.q = ''; paint(); }
    });
    form.onsubmit = e => { e.preventDefault(); body.querySelector('.v6-row-main, .lg6-card')?.focus(); };
    // R-335: one issue picker for the Filter sheet's "Cares about".
    const pickCares = () => issueSheet({ title: 'Cares about', value: caresOn(v) ? v.cares : '', any: caresOn(v), counts: caresCounts(),
      help: 'Legislators the team marked as caring about a HIPHI issue, under What they care about on their page.',
      onPick: id => { v.cares = id; paint(); root.querySelector('[data-lgfilter]')?.focus(); } });
    const pick = key => {
      const week = weekIndex(), hearing = new Set([...week.values()].flatMap(w => Object.keys(w.roles)));
      const cmtes = Object.values(S.committees || {}).filter(c => inCh(c, chamberOf(v)) && (!v.week || hearing.has(c.code) || c.code === v.cmte))
        .sort((a, b) => committeeName(a.code).localeCompare(committeeName(b.code)));
      const options = key === 'island' ? [['', 'Any island'], ...ISLAND_ORDER.filter(i => ISLANDS.includes(i)).map(i => [i, i === 'Hawaiʻi' ? 'Hawaiʻi Island' : i === 'Maui' ? 'Maui County' : i])]
        : [['', 'Any committee'], ...cmtes.map(c => [c.code, committeeName(c.code)])];
      pickerSheet({ title: key === 'island' ? 'Island' : v.week ? 'Committees hearing our bills this week' : 'Committee', value: v[key], options,
        onPick: val => { v[key] = val; paint(); root.querySelector('[data-lgfilter]')?.focus(); } });
    };
    const pickSort = () => pickerSheet({ title: 'Sort by', value: sortOf(v), options: SORTS.map(([k, l]) => [k, l]), onPick: val => { v.sort = val; paint(); root.querySelector('[data-lgsort]')?.focus(); } });
    const FWORD = { island: () => v.island ? (v.island === 'Hawaiʻi' ? 'Hawaiʻi Island' : v.island === 'Maui' ? 'Maui County' : v.island) : 'Any island',
      cmte: () => v.cmte ? committeeName(v.cmte) : 'Any committee', cares: () => caresOn(v) ? caresName(v) : 'Any issue' };
    root.addEventListener('click', async e => {
      const t = e.target;
      const seg = t.closest('[data-seg="lgask"]');
      if (seg) { v.ask = seg.dataset.val; paint(); return; }
      // All | House | Senate: remembered for the person; a committee filter of the other chamber no longer applies.
      const chb = t.closest('[data-seg="lgch"]');
      if (chb) { const ch = chb.dataset.val; if (ch !== chamberOf(v)) { v.ch = ch; if (v.cmte && ch !== 'A' && S.committees?.[v.cmte]?.chamber !== ch) v.cmte = ''; rememberCh(ch); paint(); }
        root.querySelector(`.lg6-chcap [data-seg="lgch"][data-val="${ch}"]`)?.focus(); return; }
      const wk = t.closest('[data-lgweek]');
      if (wk) { v.week = wk.dataset.lgweek === '1'; if (!v.week && v.sort === 'week') v.sort = ''; paint(); return; }
      if (t.closest('[data-lgfilter]')) { menuSheet({ title: 'Filter', items: [...['island', 'cmte', ...(PROFILES() ? ['cares'] : [])].map(k => ({ label: { island: 'Island', cmte: 'Committee', cares: 'Cares about' }[k], sub: FWORD[k](), icon: { island: 'map-pin', cmte: 'users', cares: 'tag' }[k], run: async () => { await afterBack(); if (k === 'cares') pickCares(); else pick(k); } }))] }); return; }
      if (t.closest('[data-lgcares]')) { pickCares(); return; }
      if (t.closest('[data-lgsort]')) { pickSort(); return; }
      // A jump chip: its group's heading to the top (under the phone's sticky bar), focus on it so Tab carries on there.
      const jp = t.closest('[data-lgjump]');
      // A to Z's chip goes to the first card of its letter, and focus to that card's link.
      if (jp) { const h = root.querySelector(`#${jp.dataset.lgjump}`); if (h) { const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
        (h.closest('section') || h).scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' }); (h.matches('h2') ? h : h.querySelector('a'))?.focus({ preventScroll: true }); } return; }
      const ad = t.closest('[data-lgaddr]');
      if (ad) { const a = v.addr?.results?.[+ad.dataset.lgaddr]; if (a) pickAddress(a); return; }
      const pl = t.closest('[data-lgplace]');
      if (pl) { const xx = (v.towns || [])[+pl.dataset.lgplace]; if (xx) { v.pick = { kind: 'place', label: xx.label, ids: xx.ids }; v.q = ''; inp.value = ''; paint(); } return; }
      const cl = t.closest('[data-lgclear]');
      if (cl) { if (cl.dataset.lgclear === 'filters') { v.island = ''; v.cmte = ''; v.cares = ''; } else { v.q = ''; v.pick = null; inp.value = ''; }
        paint(); (cl.closest('form') || cl.dataset.lgclear === 'q' ? inp : root.querySelector('[data-lgfilter]'))?.focus(); return; }
      const link = t.closest('[data-lglink]'); if (link) v.last = +link.dataset.lglink;
    });
  },
};

// j and k walk the rows (Enter opens the one in focus). Like every shortcut: off while typing, off when shortcuts are
// switched off in My settings, and it changes nothing.
let poppedAt = -1e9;
addEventListener('popstate', () => { poppedAt = performance.now(); });
document.addEventListener('keydown', e => {
  if ((e.key !== 'j' && e.key !== 'k') || S.route?.name !== 'legislators' || !keysOn() || e.metaKey || e.ctrlKey || e.altKey || document.querySelector('dialog[open]')) return;
  const t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
  const rows = [...document.querySelectorAll('.lg6 .v6-row-main, .lg6 .lg6-card, .lg6 .lg6-gn, .lg6 .hg-cname a')]; if (!rows.length) return;
  const i = rows.indexOf(document.activeElement); e.preventDefault();
  rows[i < 0 ? 0 : Math.max(0, Math.min(rows.length - 1, i + (e.key === 'j' ? 1 : -1)))].focus();
});
