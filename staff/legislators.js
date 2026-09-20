// Staff v2 · Legislators directory (#/legislators, plan 3.6). It answers "who do I work this week?" first: the This
// week view (the default) lists the members of committees hearing our bills in the next 7 days, most of our bills
// first. On a phone the chips This week, House, Senate and All pick the list, and the search box suggests people,
// towns, committees and (on the live tracker) street addresses while you type, ignoring ʻokina and macrons. On a
// desktop (900px and wider, build 3) the same people are a sortable table that uses the width: one toolbar (search
// that filters as you type, This week or Everyone, chamber, island, committee), and a row per legislator with the
// committees that matter, the bills of ours they hear this week and the last logged contact; the whole row opens
// the legislator. Kept from the current app's renderLegislators: the chamber choice, the committee filter, the
// address lookup (geoSuggest -> geoDistricts) and the text match over name, towns and district.
import { S, DB, esc, DEMO, hooks, advocate, fmtDate, islandOf } from './data.js';
import { plain, codesOf, geoSuggest, geoDistricts, ISLANDS, cmteName, blurb } from './model.js';
import { icon, btn, iconBtn, empty, toast, segmented, pickerChip, pickerSheet, keysOn } from './ui.js';
import { photo, partyDist, legName, legHref, seatsOf, seatsText, roleWord, RANK, wireLinks, surname } from './pathway.js';

const WEEK = 7 * 864e5;
const PARTY = { D: 'Democrat', R: 'Republican', I: 'Independent' };
const DESK = () => { try { return matchMedia('(min-width: 900px)').matches; } catch { return false; } };
const ROOMY = () => { try { return matchMedia('(min-width: 1600px)').matches; } catch { return false; } };   // a big monitor shows four bills a row, in two columns
// One state for both layouts. The phone chips are two of these at once: This week = scope week; House, Senate and
// All = everyone, with or without a chamber. Island, committee and the sort only exist on the desktop toolbar.
const view = () => (S.lgView ??= { scope: 'week', chamber: '', island: '', cmte: '', sort: null, q: '', pick: null, addr: null, focus: false, last: null });
const chipOf = v => v.scope === 'week' && !v.chamber ? 'week' : v.scope === 'week' ? '' : v.chamber || 'all';
const setChip = (v, k) => { v.scope = k === 'week' ? 'week' : 'all'; v.chamber = k === 'H' || k === 'S' ? k : ''; v.island = ''; v.cmte = ''; v.sort = null; };

// ---- data ----
// Our bills = tracked, with a position (not Monitor), the same set the current app's profile counts.
export const ourBill = b => b.tracked !== false && !!b.position && b.position !== 'monitor';
// Who hears our bills in the next 7 days: legislator id -> { bills: Set(bill id), roles: { code: role }, when: Map(bill id -> first hearing) }
export function weekIndex() {
  const now = Date.now(), ours = new Set(S.bills.filter(ourBill).map(b => b.id)), out = new Map();
  for (const h of S.hearings) {
    if (h.status === 'cancelled' || !ours.has(h.bill_id)) continue;
    const t = new Date(h.scheduled_at).getTime(); if (t <= now || t - now > WEEK) continue;
    const cs = codesOf(h.committee);
    for (const m of S.committeeMembers || []) {
      if (!cs.includes(m.committee)) continue;
      const x = out.get(m.legislator_id) || { bills: new Set(), roles: {}, when: new Map() };
      x.bills.add(h.bill_id); x.roles[m.committee] = m.role; x.when.set(h.bill_id, Math.min(t, x.when.get(h.bill_id) ?? Infinity)); out.set(m.legislator_id, x);
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
const districtQ = k => /^(s|sd|sen|senate|h|hd|rep|house)?\s*(?:district)?\s*(\d{1,2})$/.exec(k);
const committeeOf = q => { const c = S.committees?.[String(q || '').trim().toUpperCase()]; return c || null; };
// Everything a legislator can be found by, plain (no ʻokina, no macrons, lower case).
const hayCache = new Map();
const hay = l => { let h = hayCache.get(l.id); if (h) return h;
  h = plain(`${l.name} ${l.sort_name} ${l.places || ''} ${l.chamber === 'S' ? 'senate senator sen' : 'house representative rep'} district ${l.district} ${islandFor(l)} ${l.party ? PARTY[l.party] || l.party : ''} ${l.title || ''} ${seatsOf(l).map(m => `${m.committee} ${S.committees?.[m.committee]?.name || ''}`).join(' ')}`);
  hayCache.set(l.id, h); return h; };
// The text search: a district ("HD 20", "sd5", "20"), a committee code (members, chair first), or words in any order.
export function matchLegs(q) {
  const k = plain(q).trim(), legs = S.legislators || []; if (!k) return [];
  const dm = districtQ(k);
  if (dm) { const n = +dm[2], ch = dm[1] ? (dm[1][0] === 's' ? 'S' : 'H') : ''; return legs.filter(l => l.district === n && (!ch || l.chamber === ch)).sort(byDistrict); }
  const c = committeeOf(q); if (c) return committeeLegs(c.code);
  const terms = k.split(/\s+/);
  return legs.filter(l => terms.every(t => hay(l).includes(t))).sort(byDistrict);
}
const committeeLegs = code => (S.committeeMembers || []).filter(m => m.committee === code).sort((a, b) => RANK[a.role] - RANK[b.role])
  .map(m => (S.legislators || []).find(l => l.id === m.legislator_id)).filter(Boolean);
// the places a district covers, one name each ("portion of Hilo" -> "Hilo")
const placesOf = l => (l.places || '').split(/,\s*/).map(x => x.replace(/^(and\s+)?(a\s+)?portions?\s+of\s+/i, '').replace(/^and\s+/i, '').trim()).filter(Boolean);
const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Street addresses look like "75-5722 Kuakini Hwy": a number and a word, and not a district.
const addressish = q => { const t = q.trim(); return t.length >= 5 && /\d/.test(t) && /[a-z]/i.test(t) && !districtQ(plain(t)); };

// What the box suggests while you type (phones): people (by name or district) open their page; a town, a committee
// or a street address shows who represents it; the last row shows every text match.
function suggestions(v) {
  const q = v.q.trim(), k = plain(q), legs = S.legislators || [], out = [];
  const dm = districtQ(k);
  const people = dm ? matchLegs(q) : legs.filter(l => plain(l.name).includes(k) || plain(l.sort_name).includes(k))
    .sort((a, b) => (plain(surname(a)).startsWith(k) ? 0 : 1) - (plain(surname(b)).startsWith(k) ? 0 : 1) || byDistrict(a, b));
  for (const l of people.slice(0, 6)) out.push({ kind: 'person', l });
  if (!dm) {
    for (const c of Object.values(S.committees || {}).filter(c => plain(c.code) === k || (k.length >= 3 && plain(c.name).includes(k))).slice(0, 4))
      out.push({ kind: 'committee', c, ids: committeeLegs(c.code).map(l => l.id) });
    const places = new Map();
    for (const l of legs) for (const pl of placesOf(l)) {
      const p = plain(pl);
      // "kih" finds Kīhei; an address that names its town ("… Kailua-Kona") finds it too.
      // A hyphen joins a name ("Kailua-Kona" is not "Kailua").
      if ((k.length >= 2 && p.includes(k)) || (p.length >= 4 && k.length > p.length + 3 && new RegExp(`(^|[^a-z-])${escRe(p)}([^a-z-]|$)`).test(k))) {
        const x = places.get(p) || { kind: 'place', label: pl, ids: [] }; if (!x.ids.includes(l.id)) x.ids.push(l.id); places.set(p, x);
      }
    }
    out.push(...[...places.values()].sort((a, b) => a.label.localeCompare(b.label)).slice(0, 6));
  }
  if (addressish(q)) {
    if (DEMO) { if (!out.some(x => x.kind === 'place')) out.push({ kind: 'note', text: 'The sandbox finds towns in an address, not street numbers. The live tracker looks up the exact address.' }); }
    else if (v.addr && v.addr.q === q) for (const x of v.addr.results.slice(0, 5)) out.push({ kind: 'address', x });
    else out.push({ kind: 'loading' });
  }
  const all = matchLegs(q);
  if (all.length > out.filter(x => x.kind === 'person').length) out.push({ kind: 'all', n: all.length });
  if (!out.length) out.push({ kind: 'note', text: 'No match yet. Try a last name, a town, a district number or a committee code.' });
  return out;
}
function suggestHTML(v) {
  const list = v.sug = suggestions(v), q = v.q.trim();
  const who = ids => { const ls = ids.map(id => (S.legislators || []).find(l => l.id === id)).filter(Boolean); return `${ls.length} ${ls.length === 1 ? 'legislator' : 'legislators'} · ${ls.map(partyDist).join(', ')}`; };
  const rows = list.map((s, i) => {
    if (s.kind === 'person') return `<a class="row lg-sg" href="${legHref(s.l)}" data-lgsg>${photo(s.l, 32)}<span class="body"><span class="title">${esc(legName(s.l))}</span><span class="sub">${esc([partyDist(s.l), s.l.places].filter(Boolean).join(' · '))}</span></span></a>`;
    if (s.kind === 'committee') return `<button type="button" class="row lg-sg" data-lgsg="${i}"><span class="lead">${icon('users')}</span><span class="body"><span class="title">${esc(s.c.name)} (${esc(s.c.code)})</span><span class="sub">${s.c.chamber === 'S' ? 'Senate' : 'House'} committee · ${s.ids.length} members</span></span></button>`;
    if (s.kind === 'place') return `<button type="button" class="row lg-sg" data-lgsg="${i}"><span class="lead">${icon('map-pin')}</span><span class="body"><span class="title">${esc(s.label)}</span><span class="sub">${esc(who(s.ids))}</span></span></button>`;
    if (s.kind === 'address') return `<button type="button" class="row lg-sg" data-lgsg="${i}"><span class="lead">${icon('house')}</span><span class="body"><span class="title">${esc(s.x.label)}</span><span class="sub">${s.x.exact ? 'Street address' : 'Area'} · find its legislators</span></span></button>`;
    if (s.kind === 'loading') return `<div class="row lg-sgnote" role="status">${icon('loader-circle', { cls: 'lg-spin' })}<span>Looking up the address</span></div>`;
    if (s.kind === 'all') return `<button type="button" class="row lg-sg lg-sgall" data-lgsg="${i}"><span class="lead">${icon('search')}</span><span class="body"><span class="title">Show all ${s.n} matching “${esc(q)}”</span></span></button>`;
    return `<div class="row lg-sgnote">${icon('info')}<span>${esc(s.text)}</span></div>`;
  }).join('');
  return `<div class="rows lg-sug" id="lg-sug" aria-label="Suggestions">${rows}</div>`;
}

// ---- rows ----
const pdHTML = l => `<span class="lg-pd"><span aria-hidden="true">${esc(partyDist(l))}</span><span class="sr">${esc(`${PARTY[l.party] || ''} ${l.chamber === 'S' ? 'Senate' : 'House'} District ${l.district}`.trim())}</span></span>`;
// "Chair, HHS · Member, CPN"; plain seats are grouped ("Member, HHS and CPN")
const andList = xs => xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;
// Leadership seats are named; plain seats only when there is no leadership seat ("Member, HHS and LBT").
const rolesText = roles => { const by = r => Object.entries(roles).filter(([, x]) => x === r).map(([c]) => c);
  const lead = ['chair', 'vice_chair'].filter(r => by(r).length).map(r => `${roleWord(r)}, ${andList(by(r))}`);
  return lead.length ? lead.join(' · ') : by('member').length ? `Member, ${andList(by('member'))}` : ''; };
// For and against on our bills (only stances someone recorded), as icons with numbers; the words are for screen readers.
export function stanceSummary(l, only) {
  let yes = 0, no = 0;
  for (const x of S.stances || []) { if (x.legislator_id !== l.id || (only && !only.has(x.bill_id))) continue; if (x.stance === 'yes' || x.stance === 'leaning_yes') yes++; else if (x.stance === 'no' || x.stance === 'leaning_no') no++; }
  if (!yes && !no) return '';
  const words = [yes ? `For ${yes} of our bills` : '', no ? `${yes ? 'against' : 'Against'} ${no}` : ''].filter(Boolean).join(', ');
  return `<span class="lg-ss" title="${words}"><span class="sr">${words}</span>${yes ? `<span aria-hidden="true">${icon('thumbs-up')}${yes}</span>` : ''}${no ? `<span aria-hidden="true">${icon('thumbs-down')}${no}</span>` : ''}</span>`;
}
// A 64px row: 40px photo, name and party-district, a second line, the stance summary at the right.
export function legRow(l, { week, weekMode = false } = {}) {
  const w = week && week.get(l.id), n = w ? w.bills.size : 0;
  // The count comes first so a narrow screen cuts the committee list, not the number that matters this week.
  const sub = weekMode && w ? [`${n} of our bills`, rolesText(w.roles)]
    : [n ? `${n} of our bills this week` : '', l.title, seatsOf(l).map(m => m.role === 'member' ? m.committee : `${roleWord(m.role)}, ${m.committee}`).join(' · ') || l.places];
  return `<a class="row lg-row" href="${legHref(l)}">${photo(l, 40)}<span class="body"><span class="title"><span class="lg-nm">${esc(l.name)}</span>${pdHTML(l)}</span><span class="sub">${esc(sub.filter(Boolean).join(' · '))}</span></span><span class="end">${stanceSummary(l, weekMode && w ? w.bills : null)}${icon('chevron-right', { cls: 'chev' })}</span></a>`;
}
const weekOrder = week => (a, b) => week.get(b.id).bills.size - week.get(a.id).bills.size
  || Math.min(...Object.values(week.get(a.id).roles).map(r => RANK[r])) - Math.min(...Object.values(week.get(b.id).roles).map(r => RANK[r])) || a.sort_name.localeCompare(b.sort_name);

// ---- the phone page ----
const CHIPS = [['week', 'This week'], ['H', 'House'], ['S', 'Senate'], ['all', 'All']];
function bodyHTML(v) {
  const legs = S.legislators || [], q = v.q.trim(), week = weekIndex(), chip = chipOf(v);
  if (v.focus && (q.length >= 2 || /\d/.test(q))) return suggestHTML(v);
  const list = rows => `<div class="rows lg-list">${rows.map(l => legRow(l, { week, weekMode: !q && !v.pick && chip === 'week' })).join('')}</div>`;
  const clear = `<button type="button" class="btn text sm lg-clear" data-lgclear>${icon('x')}<span>Clear</span></button>`;
  if (v.pick) {
    if (v.pick.loading) return `<div class="lg-cap"><p>${icon('map-pin')}<span>Finding the districts for ${esc(v.pick.label)}</span></p></div>${`<div class="skel lg-skel"></div>`.repeat(2)}`;
    const ls = v.pick.ids.map(id => legs.find(l => l.id === id)).filter(Boolean);
    const cap = `<div class="lg-cap"><p>${icon(v.pick.kind === 'committee' ? 'users' : 'map-pin')}<span><b>${esc(v.pick.label)}</b> · ${v.pick.note ? esc(v.pick.note) : `${ls.length} ${ls.length === 1 ? 'legislator' : 'legislators'}`}</span></p>${clear}</div>`;
    return cap + (ls.length ? list(ls) : empty({ title: 'No legislator found for that address', text: 'Check the street number and town, or try the town name alone.' }));
  }
  if (q) {
    const ls = matchLegs(q);
    if (!ls.length) return empty({ title: `No one matches “${esc(q)}”`, text: 'Try a last name, a town, a district number or a committee code such as HLT.', action: btn('Clear the search', { kind: 'secondary', attrs: { 'data-lgclear': '1' } }) });
    const c = committeeOf(q);
    return `<div class="lg-cap"><p>${icon(c ? 'users' : 'search')}<span>${c ? `<b>${esc(c.name)} (${esc(c.code)})</b> · ${ls.length} members, chair first` : `${ls.length} ${ls.length === 1 ? 'legislator matches' : 'legislators match'} “${esc(q)}”`}</span></p>${clear}</div>${list(ls)}`;
  }
  if (chip === 'week') {
    const ls = legs.filter(l => week.has(l.id)).sort(weekOrder(week));
    if (!ls.length) return empty({ title: 'No hearings on our bills this week', text: 'Nothing is scheduled in the next 7 days. Everyone is under All.', action: btn('See everyone', { kind: 'secondary', attrs: { 'data-lgchip': 'all' } }) });
    return `<p class="lg-caption">${ls.length} legislators hear our bills in the next 7 days.</p>${list(ls)}`;
  }
  const ls = legs.filter(l => chip === 'all' || l.chamber === chip).sort(byDistrict);
  const cap = chip === 'H' ? `${ls.length} representatives, by district.` : chip === 'S' ? `${ls.length} senators, by district.` : `All ${ls.length} legislators: House, then Senate, by district.`;
  return `<p class="lg-caption">${cap}</p>${list(ls)}`;
}
const chipsHTML = v => { const on = !v.q.trim() && !v.pick, cur = chipOf(v); return CHIPS.map(([k, l]) => `<button type="button" class="chip" data-lgchip="${k}" aria-pressed="${on && cur === k}">${l}</button>`).join(''); };

// ---- the desktop table (build 3) ----
// Last contact = the newest logged conversation (a team note). One request brings the newest note for every
// legislator (DB.legLatestNotes, kept for the visit); a legislator page opened this visit has fresher notes
// (S.legNotes), which win. The sandbox has none until someone logs one. The cell shows a placeholder until the
// answer is in.
const noteQ = { asked: false, failed: false };
function lastContact(l) {
  const notes = S.legNotes?.[l.id];
  if (notes) { let best = null; for (const n of notes) { if (S.lgHidden?.has(n.id)) continue; const t = new Date(n.created_at).getTime(); if (!best || t > best.t) best = { t, n }; } return { loaded: true, best }; }
  if (!S.legLast) return { loaded: noteQ.failed, best: null };
  const n = S.legLast[l.id]; return { loaded: true, best: n && !S.lgHidden?.has(n.id) ? { t: new Date(n.created_at).getTime(), n } : null };
}
function contactCell(l) {
  const { loaded, best } = lastContact(l);
  if (!loaded) return `<span class="lg-wait" aria-hidden="true"></span><span class="sr">Loading</span>`;
  if (!best) return `<span class="lg-dash">${noteQ.failed ? 'Could not load' : 'None logged'}</span>`;
  const a = advocate(best.n.advocate_id), who = a ? (a.id === S.me?.id ? 'You' : a.full_name.split(' ')[0]) : '';
  return `<span class="lg-when" title="${esc(String(best.n.body || '').slice(0, 200))}">${esc(fmtDate(best.n.created_at, { month: 'short' }))}${who ? `<span class="lg-who"> · ${esc(who)}</span>` : ''}</span>`;
}
function loadContacts(ids, onEach) {
  if (S.legLast || noteQ.asked) return;
  noteQ.asked = true;
  // every row now on screen gets its answer (the list may have been filtered or repainted while the request was out)
  DB.legLatestNotes().catch(() => { noteQ.failed = true; }).finally(() => { const all = (S.legislators || []).map(l => l.id); all.forEach((id, i) => onEach(id, i === all.length - 1)); });
}
// Who is listed, in the order nobody chose: a pick (an address), a search (everyone; the filters wait), or the filters.
function deskList(v, week) {
  const legs = S.legislators || [], q = v.q.trim();
  if (v.pick && !v.pick.loading) return { mode: 'pick', ls: v.pick.ids.map(id => legs.find(l => l.id === id)).filter(Boolean) };
  if (q) return { mode: 'q', ls: matchLegs(q) };
  const ls = legs.filter(l => (v.scope !== 'week' || week.has(l.id)) && (!v.chamber || l.chamber === v.chamber) && (!v.island || islandFor(l) === v.island) && (!v.cmte || seatsOf(l).some(m => m.committee === v.cmte)));
  return { mode: 'filter', ls: v.scope === 'week' ? ls.sort(weekOrder(week)) : ls.sort(byDistrict) };
}
// A header click sorts by that column; ties keep the order above. The second click turns it round.
const SORT_DIR = { name: 1, district: 1, island: 1, cmte: 1, bills: -1, contact: -1 };
function sortVal(key, l, week, weekMode) {
  if (key === 'name') return l.sort_name || l.name;
  if (key === 'district') return (l.chamber === 'S' ? 100 : 0) + l.district;
  if (key === 'island') return islandFor(l) || 'zz';
  if (key === 'cmte') { const w = weekMode && week.get(l.id), rs = w ? Object.values(w.roles) : seatsOf(l).map(m => m.role); return rs.length ? Math.min(...rs.map(r => RANK[r])) : 9; }
  if (key === 'bills') return week.get(l.id)?.bills.size || 0;
  if (key === 'contact') return lastContact(l).best?.t || 0;
  return 0;
}
const effSort = (v, mode) => v.sort || (mode === 'filter' ? (v.scope === 'week' ? ['bills', -1] : ['district', 1]) : null);
function sorted(v, ls, week, mode) {
  if (!v.sort) return ls;
  const [key, dir] = v.sort, weekMode = mode === 'filter' && v.scope === 'week';
  return ls.map((l, i) => [l, i, sortVal(key, l, week, weekMode)]).sort(([, i, a], [, j, b]) => (typeof a === 'string' ? a.localeCompare(b) : a - b) * dir || i - j).map(([l]) => l);
}
// Empty cells stay empty: in Everyone most rows hear none of our bills this week, and the 0 beside them says so; a
// wall of "None this week" and "None set" would only bury the rows that have something. Last contact keeps its
// words ("None logged"), because no contact is something to act on.
// The bills of ours they hear this week, soonest first, one to a line: the nickname names the bill and is what gives
// way when the column is narrow; the number always shows. The count has its own column, so "and 5 more" is a cue, not
// the only place the total lives.
function weekBills(w, per) {
  if (!w) return { n: 0, html: '', all: '' };
  const bs = [...w.bills].map(id => S.bills.find(b => b.id === id)).filter(Boolean).sort((a, b) => (w.when.get(a.id) || 0) - (w.when.get(b.id) || 0) || a.bill_number.localeCompare(b.bill_number, 'en', { numeric: true }));
  const shown = bs.slice(0, per), more = bs.length - shown.length;
  const one = (b, i) => `<span class="lg-bl"><span class="lg-blt">${b.nickname ? `<b>${esc(b.nickname)}</b>` : esc(blurb(b, 60))}</span><span class="lg-bln">${esc(b.bill_number)}</span>${more > 0 && i === shown.length - 1 ? `<span class="lg-morebills">and ${more} more</span>` : ''}</span>`;
  return { n: bs.length, html: `<span class="lg-bls${per > 2 && shown.length > 1 ? ' two' : ''}">${shown.map(one).join('')}</span>`, all: bs.map(b => `${b.nickname ? b.nickname + ' ' : ''}${b.bill_number}`).join('\n') };
}
function tableHTML(v, ls, week, mode) {
  const weekMode = mode === 'filter' && v.scope === 'week', es = effSort(v, mode) || [];
  const showSt = (S.stances || []).some(x => x.stance && x.stance !== 'unknown');
  const th = (key, label, cls = '') => { const on = es[0] === key;
    return `<th scope="col" class="lg-c-${key}${cls ? ' ' + cls : ''}" aria-sort="${on ? (es[1] > 0 ? 'ascending' : 'descending') : 'none'}"><button type="button" class="lg-sort" data-lgsort="${key}">${label}${on ? icon(es[1] > 0 ? 'chevron-up' : 'chevron-down') : ''}</button></th>`; };
  const per = ROOMY() ? 4 : 2;
  const tr = l => {
    const w = week.get(l.id), wb = weekBills(w, per), seats = weekMode && w ? rolesText(w.roles) : seatsText(l);
    const names = (weekMode && w ? Object.keys(w.roles) : seatsOf(l).map(m => m.committee)).map(c => `${c}: ${cmteName(c)}`).join('\n');
    return `<tr data-lgrow="${l.id}" data-href="${legHref(l)}">
      <th scope="row" class="lg-c-name"><a class="lg-tn" href="${legHref(l)}">${photo(l, 32)}<span class="lg-tnb"><span class="lg-nm">${esc(l.name)}</span>${l.title ? `<span class="lg-tl" title="${esc(l.title)}">${esc(l.title)}</span>` : ''}</span></a></th>
      <td class="lg-c-district">${pdHTML(l)}</td>
      <td class="lg-c-island">${esc(islandFor(l)) || '<span class="lg-dash">Not known</span>'}</td>
      <td class="lg-c-cmte"${names ? ` title="${esc(names)}"` : ''}><span class="lg-clamp">${esc(seats) || '<span class="lg-dash">No committee seats</span>'}</span></td>
      <td class="lg-c-bills lg-num">${wb.n || '<span class="lg-dash">0</span>'}</td>
      <td class="lg-c-hear"${wb.n > per ? ` title="${esc(wb.all)}"` : ''}>${wb.html}</td>
      ${showSt ? `<td class="lg-c-stance">${stanceSummary(l, weekMode && w ? w.bills : null)}</td>` : ''}
      <td class="lg-c-contact">${contactCell(l)}</td>
    </tr>`; };
  return `<table class="lg-tbl"><caption class="sr">${weekMode ? 'Legislators hearing our bills in the next 7 days' : 'Legislators'}. Column headers sort. A row opens the legislator.</caption>
    <thead><tr>${th('name', 'Legislator')}${th('district', 'District')}${th('island', 'Island')}${th('cmte', weekMode ? 'Hears our bills in' : 'Committees')}${th('bills', 'Our bills', 'lg-num')}
      <th scope="col" class="lg-c-hear">Hearing this week</th>${showSt ? '<th scope="col" class="lg-c-stance" title="For and against our bills, from the stances the team has set">Stances</th>' : ''}${th('contact', 'Last contact')}</tr></thead>
    <tbody>${ls.map(tr).join('')}</tbody></table>`;
}
const filtersOn = v => !!(v.chamber || v.island || v.cmte);
function deskBody(v) {
  const week = weekIndex(), q = v.q.trim(), legs = S.legislators || [];
  const clear = (label = 'Clear') => `<button type="button" class="btn text sm lg-clear" data-lgclear>${icon('x')}<span>${label}</span></button>`;
  if (v.pick?.loading) return `<div class="lg-cap"><p>${icon('map-pin')}<span>Finding the districts for ${esc(v.pick.label)}</span></p></div>${`<div class="skel lg-skel"></div>`.repeat(2)}`;
  const { mode, ls: natural } = deskList(v, week), ls = sorted(v, natural, week, mode);
  // A street address needs the lookup; everything else (names, towns, districts, committees) filters the table as you type.
  let addr = '';
  if (mode === 'q' && addressish(q)) {
    const towns = DEMO ? (v.sug = suggestions(v)).map((x, i) => [x, i]).filter(([x]) => x.kind === 'place') : [];
    addr = DEMO ? (ls.length ? '' : `<p class="lg-snote">${icon('info')}<span>The sandbox finds towns in an address, not street numbers. The live tracker looks up the exact address.</span></p>${towns.length ? `<div class="lg-addr" role="group" aria-label="Towns in that address">${towns.map(([x, i]) => `<button type="button" class="chip" data-lgplace="${i}">${icon('map-pin')}${esc(x.label)}</button>`).join('')}</div>` : ''}`)
      : v.addr && v.addr.q === q ? (v.addr.results.length ? `<div class="lg-addr" role="group" aria-label="Addresses">${v.addr.results.slice(0, 5).map((x, i) => `<button type="button" class="chip" data-lgaddr="${i}">${icon('house')}${esc(x.label)}</button>`).join('')}</div>` : '')
      : `<p class="lg-snote" role="status">${icon('loader-circle', { cls: 'lg-spin' })}<span>Looking up the address</span></p>`;
  }
  let cap;
  if (mode === 'pick') cap = `<div class="lg-cap"><p>${icon('map-pin')}<span><b>${esc(v.pick.label)}</b> · ${v.pick.note ? esc(v.pick.note) : `${ls.length} ${ls.length === 1 ? 'legislator' : 'legislators'}`}</span></p>${clear()}</div>`;
  else if (mode === 'q') { const c = committeeOf(q);
    cap = ls.length ? `<div class="lg-cap"><p>${icon(c ? 'users' : 'search')}<span>${c ? `<b>${esc(c.name)} (${esc(c.code)})</b> · ${ls.length} members, chair first` : `${ls.length} of ${legs.length} ${ls.length === 1 ? 'matches' : 'match'} “${esc(q)}”`}. The search looks at everyone.</span></p>${clear('Clear the search')}</div>` : ''; }
  else { const n = ls.length, who = v.chamber === 'H' ? (n === 1 ? 'representative' : 'representatives') : v.chamber === 'S' ? (n === 1 ? 'senator' : 'senators') : n === 1 ? 'legislator' : 'legislators';
    // "Hawaiʻi" alone could be the state, so the island says it is one.
    const extra = [v.island ? `from ${v.island === 'Hawaiʻi' ? 'Hawaiʻi Island' : v.island}` : '', v.cmte ? `on ${v.cmte}` : ''].filter(Boolean).join(' ');
    cap = `<div class="lg-cap"><p><span><b>${n}</b> ${who}${extra ? ' ' + esc(extra) : ''}${v.scope === 'week' ? ` ${n === 1 ? 'hears' : 'hear'} our bills in the next 7 days` : ''}.</span></p>${filtersOn(v) ? clear('Clear filters') : ''}</div>`; }
  if (!ls.length) {
    if (mode === 'q' && /data-lg(place|addr)=/.test(addr)) return addr;   // an address: its town or its matches are the answer
    if (mode === 'q') return addr + empty({ title: `No one matches “${esc(q)}”`, text: 'Try a last name, a town, a district number or a committee code such as HLT.', action: btn('Clear the search', { kind: 'secondary', attrs: { 'data-lgclear': '1' } }) });
    if (mode === 'pick') return cap + empty({ title: 'No legislator found for that address', text: 'Check the street number and town, or try the town name alone.' });
    if (v.scope === 'week' && !filtersOn(v)) return empty({ title: 'No hearings on our bills this week', text: 'Nothing is scheduled in the next 7 days. Everyone is one click away.', action: btn('See everyone', { kind: 'secondary', attrs: { 'data-lgscope': 'all' } }) });
    return cap + empty({ title: 'No one fits these filters', text: v.scope === 'week' ? 'Nobody with these filters hears our bills in the next 7 days.' : 'Try one filter fewer.', action: btn('Clear filters', { kind: 'secondary', attrs: { 'data-lgclear': '1' } }) });
  }
  return addr + cap + tableHTML(v, ls, week, mode);
}
// The filter chips. A chosen filter reads as pressed (the same blue ring as a pressed chip), and says what it holds.
function filtersHTML(v) {
  const off = !!(v.q.trim() || v.pick);   // a search looks at everyone, so the filters wait
  const pc = (key, label, on) => pickerChip(label, { 'data-lgf': key, 'aria-haspopup': 'dialog', 'data-on': on && !off ? '1' : null });
  return `${segmented('lgscope', [['week', 'This week'], ['all', 'Everyone']], off ? '' : v.scope, 'Who to list')}
    ${pc('chamber', v.chamber === 'H' ? 'House' : v.chamber === 'S' ? 'Senate' : 'Both chambers', !!v.chamber)}
    ${pc('island', v.island || 'Any island', !!v.island)}
    ${pc('cmte', v.cmte ? v.cmte : 'Any committee', !!v.cmte)}`;
}

export default {
  tab: 'legislators', title: () => 'Legislators', wide: () => true,
  render() {
    const v = view(), desk = DESK(); v.focus = false;
    // The phone has no island or committee filter, and its This week chip means both chambers.
    if (!desk) { v.island = ''; v.cmte = ''; v.sort = null; if (v.scope === 'week') v.chamber = ''; }
    const box = `<form class="searchbox lg-sbox" role="search" data-lgform novalidate>
          <label class="sr" for="lg-q">${desk ? 'Filter by name, district, town, committee or street address' : 'Find a legislator by name, district, town or street address'}</label>
          ${icon('search')}
          <input id="lg-q" class="input" type="search" enterkeyhint="search" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${desk ? 'Filter by name, town or district' : 'Name, district, town or street address'}" value="${esc(v.q)}" aria-controls="lg-body">
          ${iconBtn('x', 'Clear the search', { 'data-lgclear': '1', hidden: !v.q }, 'clear')}
        </form>`;
    return `<div class="lg-dir${desk ? ' lg-desk' : ''}">
      <h1 class="lg-dtitle">Legislators</h1>
      ${desk ? `<div class="lg-bar">${box}<div class="lg-filters" id="lg-filters" role="group" aria-label="Filters">${filtersHTML(v)}</div></div>`
        : `<div class="lg-tools">${box}<div class="chips lg-chips" role="group" aria-label="Who to list" id="lg-chips">${chipsHTML(v)}</div></div>`}
      <p class="sr" role="status" id="lg-status"></p>
      <div id="lg-body">${desk ? deskBody(v) : bodyHTML(v)}</div>
    </div>`;
  },
  wire(route, app) {
    const root = app.querySelector('.lg-dir'); if (!root) return;
    const v = view(), desk = root.classList.contains('lg-desk'), inp = root.querySelector('#lg-q'), form = root.querySelector('[data-lgform]'), body = root.querySelector('#lg-body');
    const x = form.querySelector('[data-lgclear]');
    // Repaint the list only: the box keeps its focus and caret, and the chips keep their elements (a tap that blurs
    // the box and repaints must still land on the chip it started on).
    const paint = () => {
      if (desk) {
        const keep = document.activeElement?.closest?.('#lg-filters') ? document.activeElement.dataset.lgf || document.activeElement.dataset.val : null;
        root.querySelector('#lg-filters').innerHTML = filtersHTML(v);
        if (keep) root.querySelector(`#lg-filters [data-lgf="${keep}"], #lg-filters [data-val="${keep}"]`)?.focus();
        body.innerHTML = deskBody(v); x.hidden = !inp.value;
        const r = body.querySelectorAll('[data-lgrow]').length;
        root.querySelector('#lg-status').textContent = `${r} legislator${r === 1 ? '' : 's'} listed`;
        contacts();
        return;
      }
      const on = !v.q.trim() && !v.pick, cur = chipOf(v);
      root.querySelectorAll('[data-lgchip]').forEach(c => c.closest('#lg-chips') && c.setAttribute('aria-pressed', String(on && cur === c.dataset.lgchip)));
      body.innerHTML = bodyHTML(v); x.hidden = !inp.value;
      const n = body.querySelectorAll('.lg-sg').length, r = body.querySelectorAll('.lg-row').length;
      root.querySelector('#lg-status').textContent = body.querySelector('#lg-sug') ? `${n} suggestion${n === 1 ? '' : 's'}` : `${r} legislator${r === 1 ? '' : 's'}`;
    };
    // Last contact fills in cell by cell; when the table is sorted by it, the order is settled once all are in.
    const contacts = () => loadContacts([...body.querySelectorAll('[data-lgrow]')].map(tr => +tr.dataset.lgrow), (id, done) => {
      if (!root.isConnected) return;
      const l = (S.legislators || []).find(y => y.id === id), cell = l && body.querySelector(`[data-lgrow="${id}"] .lg-c-contact`);
      if (cell) cell.innerHTML = contactCell(l);
      if (done && v.sort?.[0] === 'contact') paint();
    });
    wireLinks(root);
    if (desk) contacts();
    // Address suggestions come from the live tracker's table of every Hawaiʻi street address. The sandbox never
    // makes that request (nothing may reach Supabase there), so it matches the town named in the address instead.
    const lookup = () => {
      clearTimeout(v.t); const q = v.q.trim();
      if (DEMO || !addressish(q) || (v.addr && v.addr.q === q)) return;
      v.t = setTimeout(async () => {
        let results = []; try { results = await geoSuggest(q); } catch { /* shown as no address rows */ }
        if (v.q.trim() === q) { v.addr = { q, results }; if (v.focus || desk) paint(); }
      }, 250);
    };
    const pickAddress = async a => {
      v.pick = { kind: 'address', label: a.label, loading: true };
      v.q = ''; inp.value = ''; paint();
      try {
        const d = await geoDistricts(a);
        const ids = d.found ? (S.legislators || []).filter(l => (l.chamber === 'S' && l.district === d.senate) || (l.chamber === 'H' && l.district === d.house)).map(l => l.id) : [];
        v.pick = { kind: 'address', label: a.label, ids, note: d.found ? `Senate District ${d.senate}, House District ${d.house}` : 'no districts found' };
      } catch { v.pick = null; toast('Could not look up that address. Try again.', { err: true }); }
      paint();
    };
    inp.addEventListener('input', () => { v.q = inp.value; v.pick = null; v.focus = !desk; paint(); lookup(); });
    if (!desk) inp.addEventListener('focus', () => { if (v.focus) return; v.focus = true; if (v.q.trim()) paint(); });
    inp.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { const f = body.querySelector(desk ? 'a.lg-tn' : '.lg-sg'); if (f) { e.preventDefault(); f.focus(); } }
      if (e.key === 'Escape' && inp.value) { e.preventDefault(); inp.value = ''; v.q = ''; paint(); }
    });
    body.addEventListener('keydown', e => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      const all = [...body.querySelectorAll(desk ? 'a.lg-tn' : '.lg-sg')], i = all.indexOf(document.activeElement); if (i < 0) return;
      e.preventDefault(); if (e.key === 'ArrowUp' && i === 0) inp.focus(); else all[Math.max(0, Math.min(all.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))]?.focus();
    });
    if (!desk) {
      // Leaving the box (and its suggestions) shows the list for what was typed.
      root.addEventListener('focusout', e => {
        const to = e.relatedTarget; if (!v.focus || (to && (form.contains(to) || body.querySelector('#lg-sug')?.contains(to)))) return;
        v.focus = false; paint();
      });
      // Keep the typing focus in the box while a suggestion is pressed, so the tap lands on it.
      body.addEventListener('mousedown', e => { if (e.target.closest('.lg-sg')) e.preventDefault(); });
    }
    form.onsubmit = e => { e.preventDefault(); if (desk) { body.querySelector('a.lg-tn')?.focus(); return; } inp.blur(); if (v.focus) { v.focus = false; paint(); } };
    // Back from a legislator: the row you opened has the focus again, so j and k carry on from there.
    if (desk && v.last && performance.now() - poppedAt < 1000) body.querySelector(`[data-lgrow="${v.last}"] a.lg-tn`)?.focus({ preventScroll: true });
    v.last = null;
    // This week, the committee list is the handful that hear our bills (every other choice would be an empty table).
    const committeeOptions = () => { const hearing = new Set([...weekIndex().values()].flatMap(w => Object.keys(w.roles)));
      return [['', 'Any committee'], ...Object.values(S.committees || {}).filter(c => (!v.chamber || c.chamber === v.chamber) && (v.scope !== 'week' || hearing.has(c.code) || c.code === v.cmte))
        .sort((a, b) => (a.chamber || '').localeCompare(b.chamber || '') || a.code.localeCompare(b.code)).map(c => [c.code, c.code, null, `${c.name} · ${c.chamber === 'S' ? 'Senate' : 'House'}`])]; };
    root.addEventListener('click', async e => {
      if (desk) {
        const seg = e.target.closest('[data-seg="lgscope"]');
        if (seg) { v.scope = seg.dataset.val; v.sort = null; v.q = ''; v.pick = null; inp.value = ''; paint(); root.querySelector(`[data-seg="lgscope"][data-val="${v.scope}"]`)?.focus(); return; }
        if (e.target.closest('[data-lgscope]')) { v.scope = 'all'; v.sort = null; paint(); return; }
        const f = e.target.closest('[data-lgf]');
        if (f) { const key = f.dataset.lgf;
          const count = ch => (S.legislators || []).filter(l => l.chamber === ch).length;
          const options = key === 'chamber' ? [['', 'Both chambers'], ['H', 'House', null, `${count('H')} representatives`], ['S', 'Senate', null, `${count('S')} senators`]] : key === 'island' ? [['', 'Any island'], ...ISLANDS.map(i => [i, i])] : committeeOptions();
          pickerSheet({ title: key === 'chamber' ? 'Chamber' : key === 'island' ? 'Island' : v.scope === 'week' ? 'Committees hearing our bills this week' : 'Committee', value: v[key], options,
            onPick: val => { v[key] = val; if (key === 'chamber' && v.cmte && val && S.committees?.[v.cmte]?.chamber !== val) v.cmte = ''; v.q = ''; v.pick = null; inp.value = ''; paint(); root.querySelector(`[data-lgf="${key}"]`)?.focus(); } });
          return; }
        const so = e.target.closest('[data-lgsort]');
        if (so) { const key = so.dataset.lgsort, week = weekIndex(), cur = effSort(v, deskList(v, week).mode) || [];
          v.sort = [key, cur[0] === key ? -cur[1] : SORT_DIR[key]]; paint(); body.querySelector(`[data-lgsort="${key}"]`)?.focus(); return; }
        const ad = e.target.closest('[data-lgaddr]');
        if (ad) { const a = v.addr?.results?.[+ad.dataset.lgaddr]; if (a) pickAddress(a); return; }
        const pl = e.target.closest('[data-lgplace]');
        if (pl) { const x = (v.sug || [])[+pl.dataset.lgplace]; if (x) { v.pick = { kind: 'place', label: x.label, ids: x.ids }; v.q = ''; inp.value = ''; paint(); } return; }
        if (e.target.closest('[data-lgclear]')) { const wasSearch = !!(v.q.trim() || v.pick); v.q = ''; v.pick = null; inp.value = ''; if (!wasSearch) { v.chamber = ''; v.island = ''; v.cmte = ''; } paint(); if (e.target.closest('form')) inp.focus(); return; }
        // The whole row opens the legislator (the name is the real link, for the keyboard and for a new tab).
        const row = e.target.closest('tr[data-href]');
        if (row && !e.target.closest('a, button') && !e.defaultPrevented && !String(getSelection?.() || '').trim()) {
          v.last = +row.dataset.lgrow;
          if (e.metaKey || e.ctrlKey) window.open(location.pathname + location.search + row.dataset.href, '_blank', 'noopener'); else S.go(row.dataset.href);
        }
        const link = e.target.closest('a.lg-tn'); if (link) v.last = +link.closest('tr').dataset.lgrow;
        return;
      }
      const chipEl = e.target.closest('[data-lgchip]');
      if (chipEl) { setChip(v, chipEl.dataset.lgchip); v.q = ''; v.pick = null; inp.value = ''; paint(); return; }
      if (e.target.closest('[data-lgclear]')) { v.q = ''; v.pick = null; inp.value = ''; paint(); if (e.target.closest('form')) inp.focus(); return; }
      const sg = e.target.closest('button[data-lgsg]'); if (!sg) return;
      const s = (v.sug || [])[+sg.dataset.lgsg]; if (!s) return;
      if (s.kind === 'all') { v.focus = false; inp.blur(); paint(); return; }
      v.focus = false; inp.blur();
      if (s.kind === 'place') v.pick = { kind: 'place', label: s.label, ids: s.ids };
      else if (s.kind === 'committee') v.pick = { kind: 'committee', label: `${s.c.name} (${s.c.code})`, ids: s.ids, note: `${s.ids.length} members, chair first` };
      else if (s.kind === 'address') return pickAddress(s.x);
      v.q = ''; inp.value = ''; paint();
    });
  },
};

// j and k walk the table's rows (Enter opens the one in focus, because the name is a link). Like every shortcut:
// off while typing, off when shortcuts are switched off in My settings, and it changes nothing.
try { matchMedia('(min-width: 1600px)').addEventListener('change', () => { if (S.route?.name === 'legislators' && !document.querySelector('dialog[open]')) hooks.render(); }); } catch { /* old browsers */ }
let poppedAt = -1e9;
addEventListener('popstate', () => { poppedAt = performance.now(); });
document.addEventListener('keydown', e => {
  if ((e.key !== 'j' && e.key !== 'k') || S.route?.name !== 'legislators' || !keysOn() || e.metaKey || e.ctrlKey || e.altKey || document.querySelector('dialog[open]')) return;
  const t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
  const rows = [...document.querySelectorAll('.lg-tbl tbody a.lg-tn')]; if (!rows.length) return;
  const i = rows.indexOf(document.activeElement); e.preventDefault();
  rows[i < 0 ? 0 : Math.max(0, Math.min(rows.length - 1, i + (e.key === 'j' ? 1 : -1)))].focus();
});
