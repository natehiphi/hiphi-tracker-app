// Staff v6 · Legislators (#/legislators; R-336 spec 3.3 and 6, V23; F139-F144, F150). Three page tabs, each with its own
// address, and one find box on every tab (F143):
//   Who to ask (#/legislators, ?view=ask): the Get hearings board, the same component as Hearings > Get hearings (push.js
//     askBoard, drawn here since the integration: one board, so the two doors never disagree, X7; holding.js's own board
//     below is kept only as the fallback should askBoard fail). Mine · My coalitions · Team is a visible switch, the same as Hearings'.
//     Each chair carries ONE email button: the viewer's own asks with them, to them alone, named by bill (V24).
//   Everyone (?view=everyone): the directory, a name and one line per legislator (district and island, their role on our
//     bills, last contact), with the "Hearing our bills this week" preset (F142, v5's This week view), the Filter sheet
//     (chamber, island, committee, and Cares about on the practice copy, R-335), and a Sort (district, name, island, chairs
//     first, our bills this week, last contact). j and k walk the rows. Between sessions #/legislators opens here (P10).
//   Holding our bills (?view=holding): the compact view of the same board, one row per chair (holding.js, F139, F141),
//     with the same switch, words and button rule as Who to ask.
// The find box looks at everyone, whatever the tab: a name, a town, a district ("HD 20", "sd5"), a committee ("HLT"), with
// or without the ʻokina and macrons; a street address looks up its districts on the live app (rule 3: the address is never
// kept, only the districts it finds). The tab comes from the address (route.view): v5's ?view=all|hold|week still open
// Everyone, Holding and Everyone's this-week preset.
import { S, esc, DEMO, islandOf, SESSION_OVER } from './data.js';
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
const view = () => (S.lg6 ??= { ask: '', week: false, chamber: '', island: '', cmte: '', cares: '', sort: '', q: '', pick: null, addr: null, last: null });
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

// ---- Everyone: the directory (F142, F144) ----
// A legislator's role on our bills, in one fact: this week's hearings first, then the bills they hold, then the bills in
// their committees, else their leadership title or the towns they represent (a supporter says "I live in Kaūmana").
function roleWords(l, week) {
  const w = week.get(l.id);
  // "Chairs a committee hearing 2 of our bills" was said of Rep. Takayama, who chairs House Health while one of the two
  // was heard in Judiciary, where he is a member: the count is every committee of his, the chair only the ones he chairs.
  if (w) { const chaired = Object.entries(w.roles).filter(([, r]) => r === 'chair').map(([c]) => c), n = w.bills.size;
    const inChaired = new Set(chaired.flatMap(c => [...(w.byCm?.get(c) || [])]));
    if (chaired.length && inChaired.size === n) return `Chairs ${andWords(chaired.map(c => committeeName(c)))}, hearing ${n === 1 ? 'one' : n} of our bills this week`;
    return `Hears ${n === 1 ? 'one' : n} of our bills this week${chaired.length ? ` · chairs ${andWords(chaired.map(c => committeeName(c)))}` : ''}`; }
  const seats = seatsOf(l).map(m => m.committee), chairs = seatsOf(l).filter(m => m.role === 'chair').map(m => m.committee);
  let hold = 0, inCm = 0;
  for (const b of S.bills) { if (!ourBill(b) || diedish(b)) continue; const st = stopOf(b); if (st.phase !== 'committee' || !st.committee) continue;
    const cs = codesOf(st.committee); if (cs.some(c => seats.includes(c))) { inCm++; if (st.column === 'a' && cs.some(c => chairs.includes(c))) hold++; } }
  if (hold) return `Chair holding ${hold === 1 ? 'one' : hold} of our bills with no hearing yet`;
  if (inCm) return `${inCm === 1 ? 'One' : inCm} of our bills in their committees`;
  if (l.title) return l.title;
  return placesOf(l).slice(0, 3).join(', ');
}
// The district and its island ("District 6, Hawaiʻi Island"): Hawaiʻi has a Kailua on Oʻahu and a Kailua-Kona on Hawaiʻi
// Island, so the island tells two towns apart (F143). The party is on their page.
const islandWords = l => { const i = islandFor(l); return i === 'Hawaiʻi' ? 'Hawaiʻi Island' : i; };
const districtWords = l => [`District ${l.district}`, islandWords(l)].filter(Boolean).join(', ');
// A row: the name, the district and island, and one line: their role on our bills and the last contact; found by a town,
// the towns of theirs that match come first ("Covers Kailua and Lanikai"). Their photo leads the row (R-336 walk 2: the
// directory showed no faces; it used to be legRow's, which this list no longer draws).
// The row's face: the photo over its initial. The initial is drawn by CSS (legislators.css .lg6-rph::before) rather than as
// text, so a row whose photo fails still reads as its name, district and one line (the budget's four facts to a row,
// tests/staff6_budget.py); a photo that fails to load removes itself and the initial shows.
const face = l => `<span class="lg6-rph" aria-hidden="true" data-i="${esc((l.name || '?')[0])}">${l.photo_url ? `<img class="lg-ph s40" src="${esc(l.photo_url)}" alt="" loading="lazy" onerror="this.remove()">` : ''}</span>`;
function personRow(l, week, { from = '', q = '' } = {}) {
  const towns = q ? townHits(l, q) : [];
  const line = (towns.length ? [`Covers ${andList(towns.slice(0, 2))}${towns.length > 2 ? ' and more' : ''}`, roleWords(l, week)] : [roleWords(l, week), contactWords(l)]).filter(Boolean).join(' · ');
  return `<div class="v6-row lg6-wrap" role="listitem" data-v6row="lg${l.id}" data-lgrow="${l.id}"><a class="v6-row-main lg6-prow" href="${legHref(l)}${from ? `?from=${from}` : ''}" data-lglink="${l.id}">${face(l)}<span class="lg6-rtx"><span class="v6-row-top"><span class="v6-row-name">${esc(legName(l))}</span><span class="v6-row-num">${esc(districtWords(l))}</span></span>${line ? `<span class="v6-row-line"><span>${nw(esc(line))}</span></span>` : ''}</span></a></div>`;
}
const SORTS = [['district', 'District'], ['name', 'Name'], ['island', 'Island'], ['chairs', 'Chairs first'], ['week', 'Our bills this week'], ['contact', 'Last contact']];
const sortOf = v => v.sort || (v.week ? 'week' : 'district');
function sortVal(key, l, week) {
  if (key === 'name') return plain(surname(l));
  if (key === 'district') return (l.chamber === 'S' ? 100 : 0) + l.district;
  if (key === 'island') return islandFor(l) || 'zz';
  if (key === 'chairs') { const w = week.get(l.id), rs = w ? Object.values(w.roles) : seatsOf(l).map(m => m.role); return rs.length ? Math.min(...rs.map(r => RANK[r])) : 9; }
  if (key === 'week') return -(week.get(l.id)?.bills.size || 0);
  if (key === 'contact') return -(lastContact(l).best?.t || 0);
  return 0;
}
function sorted(ls, key, week) {
  return ls.map((l, i) => [l, i, sortVal(key, l, week), (l.chamber === 'S' ? 100 : 0) + l.district]).sort(([, i, a, da], [, j, b, db]) => (typeof a === 'string' ? a.localeCompare(b) : a - b) || da - db || i - j).map(([l]) => l);
}
const filtersN = v => [v.chamber, v.island, v.cmte, caresOn(v)].filter(Boolean).length;
function everyoneList(v, week) {
  const keep = l => (!v.chamber || l.chamber === v.chamber) && (!v.island || islandFor(l) === v.island) && (!v.cmte || seatsOf(l).some(m => m.committee === v.cmte));
  let ls = (S.legislators || []).filter(keep);
  if (caresOn(v)) { const ids = caresIds(v.cares); ls = ls.filter(l => ids.has(l.id)); }
  if (v.week) ls = ls.filter(l => week.has(l.id));
  return sorted(ls, sortOf(v), week);
}
function everyoneHTML(v) {
  const week = weekIndex(), ls = everyoneList(v, week), all = (S.legislators || []).length;
  const on = filtersN(v), who = v.chamber === 'H' ? 'representatives' : v.chamber === 'S' ? 'senators' : 'legislators';
  const bits = [v.island ? `from ${v.island === 'Hawaiʻi' ? 'Hawaiʻi Island' : v.island}` : '', v.cmte ? `on ${committeeName(v.cmte)}` : '', caresOn(v) ? `who care about ${caresName(v)}` : ''].filter(Boolean).join(' ');
  // The preset's caption stays on one line at 320 when nothing else narrows the list (A-1: the first row within 400px).
  const cap = v.week ? `${ls.length}${on ? ` ${ls.length === 1 ? who.replace(/s$/, '') : who}${bits ? ' ' + bits : ''}` : ''} ${ls.length === 1 ? 'hears' : 'hear'} our bills in the next 7 days`
    : `${ls.length === all && !on ? `All ${all} legislators` : `${ls.length} ${ls.length === 1 ? who.replace(/s$/, '') : who}${bits ? ' ' + bits : ''}`}, by ${SORTS.find(x => x[0] === sortOf(v))[1].toLowerCase()}`;
  const clear = on ? btn('Clear filters', { kind: 'text', sm: true, icon: 'x', attrs: { 'data-lgclear': 'filters' } }) : '';
  if (!ls.length) {
    if (v.week && !on) return empty({ title: 'No hearings on our bills this week', text: 'Nothing is scheduled in the next 7 days.', action: btn('See everyone', { kind: 'secondary', attrs: { 'data-lgweek': '0' } }) });
    if (caresOn(v) && on === 1) return empty({ title: `No legislator cares about ${esc(caresName(v))} yet`, text: 'To add one, open a legislator’s page and add the issue under What they care about.', action: btn('Pick another issue', { kind: 'secondary', attrs: { 'data-lgcares': '1', 'aria-haspopup': 'dialog' } }) });
    return empty({ title: 'No one fits these filters', text: v.week ? 'Nobody with these filters hears our bills in the next 7 days.' : 'Try one filter fewer.', action: btn('Clear filters', { kind: 'secondary', attrs: { 'data-lgclear': 'filters' } }) });
  }
  return `<div class="lg6-cap"><p>${esc(cap)}.</p>${clear}</div><div class="v6-list lg6-list" role="list" aria-label="Legislators">${ls.map(l => personRow(l, week)).join('')}</div>`;
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
// preset never pushes the row onto two lines. Below 400px Sort moves into the Filter sheet and Filter sits beside the box.
const narrow = () => { try { return matchMedia('(max-width: 399px)').matches; } catch { return false; } };
function everyoneTools(v) {
  const sort = SORTS.find(x => x[0] === sortOf(v))[1];
  return `<div class="lg6-tools lg6-etools" role="group" aria-label="Show">
    ${btn('Hearing our bills this week', { kind: 'secondary', sm: true, icon: v.week ? 'check' : 'calendar', cls: 'lg6-preset', attrs: { 'data-lgweek': v.week ? '0' : '1', 'aria-pressed': String(!!v.week) } })}
    ${filterBtn(filtersN(v), { 'data-lgfilter': '1' })}
    ${btn('Sort', { kind: 'secondary', sm: true, iconEnd: 'chevron-down', cls: 'lg6-sortb', attrs: { 'data-lgsort': '1', 'aria-haspopup': 'dialog', 'aria-label': `Sort, now by ${sort.toLowerCase()}` } })}
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
    return cap + (ls.length ? `<div class="v6-list lg6-list" role="list" aria-label="Legislators">${ls.map(l => personRow(l, week)).join('')}</div>` : empty({ title: 'No legislator found for that address', text: 'Check the street number and town, or try the town name alone.' }));
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
  return `${addr}<div class="lg6-cap"><p>${icon(c ? 'users' : 'search')}<span>${cap}</span></p></div><div class="v6-list lg6-list" role="list" aria-label="Legislators found">${ls.map(l => personRow(l, week, { q: c ? '' : q })).join('')}</div>`;
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
        <input id="lg-q" class="input" type="search" enterkeyhint="search" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Find a legislator" value="${esc(v.q)}" aria-controls="lg-body">
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
      const n = body.querySelectorAll('[data-lgrow], .lg6-grp, [data-v6row^="hold-"]').length;
      root.querySelector('#lg-status').textContent = searching(v) || tab === 'everyone' ? `${n} ${n === 1 ? 'legislator' : 'legislators'} listed` : '';
    };
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
      if (e.key === 'ArrowDown') { const f = body.querySelector('.v6-row-main'); if (f) { e.preventDefault(); f.focus(); } }
      if (e.key === 'Escape' && inp.value) { e.preventDefault(); inp.value = ''; v.q = ''; paint(); }
    });
    form.onsubmit = e => { e.preventDefault(); body.querySelector('.v6-row-main')?.focus(); };
    // R-335: one issue picker for the Filter sheet's "Cares about".
    const pickCares = () => issueSheet({ title: 'Cares about', value: caresOn(v) ? v.cares : '', any: caresOn(v), counts: caresCounts(),
      help: 'Legislators the team marked as caring about a HIPHI issue, under What they care about on their page.',
      onPick: id => { v.cares = id; paint(); root.querySelector('[data-lgfilter]')?.focus(); } });
    const pick = key => {
      const count = ch => (S.legislators || []).filter(l => l.chamber === ch).length, week = weekIndex(), hearing = new Set([...week.values()].flatMap(w => Object.keys(w.roles)));
      const cmtes = Object.values(S.committees || {}).filter(c => (!v.chamber || c.chamber === v.chamber) && (!v.week || hearing.has(c.code) || c.code === v.cmte))
        .sort((a, b) => (a.chamber || '').localeCompare(b.chamber || '') || committeeName(a.code).localeCompare(committeeName(b.code)));
      const options = key === 'chamber' ? [['', 'Both chambers'], ['H', 'House', null, `${count('H')} representatives`], ['S', 'Senate', null, `${count('S')} senators`]]
        : key === 'island' ? [['', 'Any island'], ...ISLANDS.map(i => [i, i === 'Hawaiʻi' ? 'Hawaiʻi Island' : i])]
        : [['', 'Any committee'], ...cmtes.map(c => [c.code, committeeName(c.code)])];
      pickerSheet({ title: key === 'chamber' ? 'Chamber' : key === 'island' ? 'Island' : v.week ? 'Committees hearing our bills this week' : 'Committee', value: v[key], options,
        onPick: val => { v[key] = val; if (key === 'chamber' && v.cmte && val && S.committees?.[v.cmte]?.chamber !== val) v.cmte = ''; paint(); root.querySelector('[data-lgfilter]')?.focus(); } });
    };
    const pickSort = () => pickerSheet({ title: 'Sort by', value: sortOf(v), options: SORTS.map(([k, l]) => [k, l]), onPick: val => { v.sort = val; paint(); (root.querySelector('[data-lgsort]')?.offsetParent ? root.querySelector('[data-lgsort]') : root.querySelector('[data-lgfilter]'))?.focus(); } });
    const FWORD = { chamber: () => v.chamber === 'H' ? 'House' : v.chamber === 'S' ? 'Senate' : 'Both chambers', island: () => v.island || 'Any island',
      cmte: () => v.cmte ? committeeName(v.cmte) : 'Any committee', cares: () => caresOn(v) ? caresName(v) : 'Any issue' };
    root.addEventListener('click', async e => {
      const t = e.target;
      const seg = t.closest('[data-seg="lgask"]');
      if (seg) { v.ask = seg.dataset.val; paint(); return; }
      const wk = t.closest('[data-lgweek]');
      if (wk) { v.week = wk.dataset.lgweek === '1'; if (!v.week && v.sort === 'week') v.sort = ''; paint(); return; }
      if (t.closest('[data-lgfilter]')) { menuSheet({ title: narrow() ? 'Filter and sort' : 'Filter', items: [...['chamber', 'island', 'cmte', ...(PROFILES() ? ['cares'] : [])].map(k => ({ label: { chamber: 'Chamber', island: 'Island', cmte: 'Committee', cares: 'Cares about' }[k], sub: FWORD[k](), icon: { chamber: 'landmark', island: 'map-pin', cmte: 'users', cares: 'tag' }[k], run: async () => { await afterBack(); if (k === 'cares') pickCares(); else pick(k); } })),
        ...(narrow() ? [{ label: 'Sort', sub: `By ${SORTS.find(x => x[0] === sortOf(v))[1].toLowerCase()}`, icon: 'list-ordered', run: async () => { await afterBack(); pickSort(); } }] : [])] }); return; }
      if (t.closest('[data-lgcares]')) { pickCares(); return; }
      if (t.closest('[data-lgsort]')) { pickSort(); return; }
      const ad = t.closest('[data-lgaddr]');
      if (ad) { const a = v.addr?.results?.[+ad.dataset.lgaddr]; if (a) pickAddress(a); return; }
      const pl = t.closest('[data-lgplace]');
      if (pl) { const xx = (v.towns || [])[+pl.dataset.lgplace]; if (xx) { v.pick = { kind: 'place', label: xx.label, ids: xx.ids }; v.q = ''; inp.value = ''; paint(); } return; }
      const cl = t.closest('[data-lgclear]');
      if (cl) { if (cl.dataset.lgclear === 'filters') { v.chamber = ''; v.island = ''; v.cmte = ''; v.cares = ''; } else { v.q = ''; v.pick = null; inp.value = ''; }
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
  const rows = [...document.querySelectorAll('.lg6 .v6-row-main, .lg6 .lg6-gn, .lg6 .hg-cname a')]; if (!rows.length) return;
  const i = rows.indexOf(document.activeElement); e.preventDefault();
  rows[i < 0 ? 0 : Math.max(0, Math.min(rows.length - 1, i + (e.key === 'j' ? 1 : -1)))].focus();
});
