// Your legislators (redesign 9/19): the finder (#/legislators) and one legislator's page (#/legislator/<id>).
// A newcomer types a street address or a town and gets the two people who represent them, one senator and one
// representative, with a ready-to-edit email. The districts can be remembered on this device (localStorage
// 'hiphi_districts' = { senate, house, label }) so bill pages can say "Your senator".
// Address lookup is the same as track.js: suggestions from our own table of every Hawaiʻi street address
// (fetchAddrSuggest, which carries the districts), and legLookupAddress for anything typed in full. What changed:
// towns rank above street addresses when there are no digits, address suggestions name their town or island,
// a ZIP code offers its towns, and "Browse all" is a short list grouped by island instead of 77 cards.
// 9/19, after Nate's review: a real desktop view (the two result cards side by side across the wide frame, the
// directory as a grid under an island picker drawn with the new island chain, a legislator page with a contact
// panel at the side), bills named by their nickname when they have one, and the remembered districts now carry the
// person's island ('hiphi_districts' = { senate, house, label, island }) so other screens can highlight it.
import { S, app, esc, icon, blurb, nick, spaced, billPath, alive, plainStatus, posInfo, cmteLabel, codesOf, stopOf, hearingsOf,
  ensureBill, legById, legTitle, legPhoto, looksLikeAddress, legLookupAddress, markDone, yay } from './core.js';
import { btn, chip, notice, inlineErr, empty, row } from './ui.js';
import { islands } from './art.js';
import { createAddressPicker } from './addresspicker.js';

const KEY = 'hiphi_districts';
// Screen state for this visit. Nothing here reaches a server; the address itself is never stored.
const P = { q: '', pick: null, finding: null, err: '', changing: false, remember: true,
  mail: null, text: {}, copied: null, sent: {}, isl: null, bills: {}, from: '' };
// The debounced address fetch is the one stateful, async part of this page; it is its own module (addresspicker.js)
// so the onboarding wizard can run a second, independent instance rather than sharing this one.
const AP = createAddressPicker();

// ---------------- places and islands (Hawaiʻi-specific) ----------------
// Hawaiʻi's 2022 district maps, in use until the 2032 redistricting: Senate 1-4 and House 1-8 are on Hawaiʻi
// Island, Senate 5-7 and House 9-14 in Maui County (with Molokaʻi and Lānaʻi), Senate 8 and House 15-17 on Kauaʻi
// (with Niʻihau), and everything else on Oʻahu. The directory has no island column, so it comes from the number.
const ISLANDS = [['O', 'Oʻahu', ''], ['H', 'Hawaiʻi Island', ''], ['M', 'Maui County', 'Maui, Molokaʻi and Lānaʻi'], ['K', 'Kauaʻi', 'Kauaʻi and Niʻihau']];
const ISLAND_NAME = Object.fromEntries(ISLANDS.map(([c, n]) => [c, n]));
const islandOfSeat = (ch, d) => ch === 'S' ? (d <= 4 ? 'H' : d <= 7 ? 'M' : d === 8 ? 'K' : 'O') : (d <= 8 ? 'H' : d <= 14 ? 'M' : d <= 17 ? 'K' : 'O');
const islandOf = l => islandOfSeat(l.chamber, l.district);
// The island chain drawing (pub/art.js) names eight islands; a group of districts lights up its main one (Maui
// County is drawn as Maui, Kauaʻi's group as Kauaʻi).
const ART_KEY = { O: 'oahu', H: 'hawaii', M: 'maui', K: 'kauai' };
// The person's own island, for hiphi_districts.island: one of hawaii, maui, kahoolawe, lanai, molokai, oahu, kauai,
// niihau. Districts cannot tell Molokaʻi or Lānaʻi from Maui (one Senate and one House district cover all three),
// and Niʻihau shares Kauaʻi's, so the town decides when we know it.
export function islandKey(senate, house, town = '') {
  const code = +senate ? islandOfSeat('S', +senate) : +house ? islandOfSeat('H', +house) : '';
  const t = String(town || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[ʻ‘’`']/g, '').toLowerCase();
  if (code === 'M' && /molokai|kaunakakai|hoolehua|kualapuu|maunaloa|kalaupapa/.test(t)) return 'molokai';
  if (code === 'M' && /lanai/.test(t)) return 'lanai';
  if (code === 'K' && /niihau/.test(t)) return 'niihau';
  return ART_KEY[code] || '';
}
const CHAMBER_WORD = { S: 'Senate', H: 'House' };
const PARTY = { D: 'Democrat', R: 'Republican' };
// Place names arrive with a mix of ʻokina, curly quotes, straight quotes and macrons; match without any of them.
const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[ʻ‘’`'.]/g, '').replace(/[-/]/g, ' ')
  .toLowerCase().replace(/^ft\b/, 'fort').replace(/\s+/g, ' ').trim();
// Show the ʻokina as an ʻokina (the Capitol pages type it as a quote mark).
const okina = s => String(s || '').replace(/['‘’`](?=[aeiouāēīōū])/gi, 'ʻ');
const cover = l => okina(l.places || '').replace(/\b(a )?portions? of\b/gi, 'part of');

// The directory can list two people for one seat after a mid-term appointment; the one with a Capitol email serves.
let seatCache = null;
function seated() {
  if (seatCache && seatCache.src === S.legislators) return seatCache.list;
  const by = new Map();
  for (const l of S.legislators || []) { if (l.active === false) continue; const k = l.chamber + l.district; if (!by.has(k)) by.set(k, []); by.get(k).push(l); }
  const list = [...by.values()].flatMap(g => g.length > 1 && g.some(l => l.email) ? g.filter(l => l.email) : g);
  seatCache = { src: S.legislators, list, ids: new Set(list.map(l => l.id)) };
  return list;
}
const bySeat = (a, b) => a.district - b.district || a.name.localeCompare(b.name);
const forDistricts = (sd, hd) => seated().filter(l => (l.chamber === 'S' && l.district === +sd) || (l.chamber === 'H' && l.district === +hd));

// One name per place, per island (there are three Waimeas and two Punaluʻus). "portions of Kurtistown and Keaʻau"
// is two places; "East and Upcountry Maui" is East Maui and Upcountry Maui. Ranges ("Kahuku to Mokulēʻia") read
// badly as a suggestion, so they only count when someone types a street address.
function splitPlaces(str) {
  const out = [];
  for (let p of String(str || '').split(/,\s*/)) {
    p = p.replace(/^(and\s+)?(a\s+)?(portions?\s+of\s+)?(the\s+)?/i, '').trim();
    if (!p || /\b(thru|to)\b/i.test(p)) continue;
    const m = /^(\S+) and (\S+) (Maui)$/i.exec(p);
    if (m) { out.push(`${m[1]} ${m[3]}`, `${m[2]} ${m[3]}`); continue; }
    out.push(...p.split(/\s+and\s+|\s*\/\s*/).map(x => x.trim()).filter(x => x.length > 1));
  }
  return out;
}
let placeCache = null;
function placeIndex() {
  if (placeCache && placeCache.src === S.legislators) return placeCache.map;
  const map = new Map(), marks = s => (s.match(/[^\x20-\x7e]/g) || []).length;
  for (const l of seated()) for (const name of splitPlaces(l.places)) {
    const isl = islandOf(l), k = norm(name) + '|' + isl, label = okina(name);
    const x = map.get(k) || { key: norm(name), label, island: isl, ids: [] };
    if (marks(label) > marks(x.label)) x.label = label;   // keep the spelling with the most diacritics
    if (!x.ids.includes(l.id)) x.ids.push(l.id);
    map.set(k, x);
  }
  placeCache = { src: S.legislators, map };
  return map;
}
// Everyone who serves a place. Kauaʻi and Niʻihau are one Senate district, so a Kauaʻi town always has its senator.
function placeIds(p) {
  const ids = [...p.ids];
  for (const ch of ['S', 'H']) if (!ids.some(id => legById(id)?.chamber === ch)) {
    const only = seated().filter(l => l.chamber === ch && islandOf(l) === p.island);
    if (only.length === 1) ids.push(only[0].id);
  }
  return ids;
}

// Town -> the two people who serve it. Pure and synchronous: the full finder's street-address lookup
// is async and stateful, and the guided start only needs the town case (pub/start.js legislators step).
export function townMatches(q, cap = 5) {
  const k = norm(String(q || '').trim());
  if (k.length < 2) return [];
  const all = [...placeIndex().values()];
  const starts = all.filter(p => p.key.startsWith(k)), has = all.filter(p => !p.key.startsWith(k) && p.key.includes(k));
  return [...starts, ...has].slice(0, cap).map(p => ({ key: p.key, label: p.label, island: p.island }));
}
export function lookupTown(key) {
  const p = [...placeIndex().values()].find(x => x.key === norm(key));
  if (!p) return null;
  const people = placeIds(p).map(legById).filter(Boolean);
  // A town can straddle districts, and some towns are not listed by their senator at all. Only name a
  // person when the town settles it - exactly one per chamber. Otherwise say it depends on the street,
  // rather than picking one and being wrong about somebody's own legislator.
  const one = ch => { const x = people.filter(l => l.chamber === ch); return x.length === 1 ? x[0] : null; };
  return { label: p.label, island: p.island, senator: one('S'), rep: one('H') };
}

// ZIP codes the Postal Service uses in Hawaiʻi, with the towns and neighbourhoods each one covers, as the
// district directory spells them (so a pick finds its legislators). Honolulu ZIPs list neighbourhoods.
const ZIPS = {
  O: { 96701: 'ʻAiea, Hālawa, Pearlridge, Waimalu, ʻAiea Heights, Royal Summit, Newtown', 96706: 'ʻEwa Beach, Ocean Pointe, Iroquois Point, ʻEwa by Gentry, ʻEwa Villages, Hoʻopili, Honouliuli',
    96707: 'Kapolei, Makakilo, Kalaeloa, Ko ʻOlina, Honokai Hale, Barbers Point, Fernandez Village, Varona Village', 96712: 'Haleʻiwa, Waimea, Sunset Beach, Kawailoa Beach',
    96717: 'Hauʻula, Punaluʻu', 96730: 'Kaʻaʻawa, Kahana', 96731: 'Kahuku, Kawela Bay', 96734: 'Kailua, Lanikai, Keolu Hills, Maunawili', 96744: 'Kāneʻohe, ʻĀhuimanu, Kahaluʻu, Waiāhole',
    96759: 'Kunia Camp', 96762: 'Lāʻie', 96782: 'Pearl City, Waiau, Pacific Palisades, Momilani', 96786: 'Wahiawā, Whitmore Village, Launani Valley',
    96789: 'Mililani, Mililani Town, Mililani Mauka, Waipiʻo Acres, Koa Ridge', 96791: 'Waialua, Mokulēʻia', 96792: 'Waiʻanae, Mākaha, Nānākuli, Māʻili, Mākua', 96795: 'Waimānalo',
    96797: 'Waipahu, Waikele, Village Park, Royal Kunia, Crestview, Waipiʻo Gentry, West Loch Estates', 96813: 'Downtown, Chinatown, Punchbowl, Pauoa, Tantalus, Papakōlea',
    96814: 'Ala Moana, Kakaʻako', 96815: 'Waikīkī, Kapahulu', 96816: 'Kaimukī, Kapahulu, Pālolo, Pālolo Valley, St. Louis Heights, Maunalani Heights, Wilhelmina Rise, Kāhala, Diamond Head',
    96817: 'Liliha, Nuʻuanu, Pālama, Kapālama, ʻĀlewa, Puʻunui, Dowsett Highlands, Pacific Heights, Iwilei, Kalihi',
    96818: 'Salt Lake, Āliamanu, Foster Village, Hickam, Hickam Village', 96819: 'Kalihi, Kalihi Valley, Kalihi Kai, Kamehameha Heights, Moanalua, Māpunapuna, Airport, Sand Island, Keʻehi Lagoon, Red Hill, Fort Shafter',
    96821: 'ʻĀina Haina, Niu Valley, Niu, Kuliʻouʻou, Waiʻalae-Kāhala, Waiʻalae', 96822: 'Mānoa, Makiki', 96825: 'Hawaiʻi Kai, Portlock, Kalama Valley', 96826: 'Mōʻiliʻili, McCully',
    96853: 'Hickam', 96857: 'Schofield Barracks', 96860: 'Pearl Harbor', 96863: 'Kāneʻohe Bay' },
  H: { 96704: 'Captain Cook, Napoʻopoʻo, Hoʻokena', 96718: 'Volcano', 96719: 'Hāwī, Halaʻula', 96720: 'Hilo, Keaukaha, Kaūmana', 96721: 'Hilo', 96725: 'Hōlualoa', 96726: 'Hōnaunau',
    96727: 'Hāmākua', 96737: 'Hawaiian Ocean View', 96738: 'Waikoloa, Puakō', 96739: 'Keauhou', 96740: 'Kailua-Kona, Kalaoa, Honokōhau', 96743: 'Waimea, Kawaihae, Makahālau, Waikiʻi',
    96745: 'Kailua-Kona', 96749: 'Keaʻau, Hawaiian Paradise Park, Orchidlands Estate, Ainaloa, Hawaiian Acres', 96750: 'Kealakekua', 96755: 'Kohala, Māhukona', 96760: 'Kurtistown, Fern Acres',
    96764: 'North Hilo', 96771: 'Mountain View, Glenwood, Fern Forest', 96772: 'Nāʻālehu, Waiʻōhinu', 96777: 'Pāhala, Punaluʻu',
    96778: 'Pāhoa, Hawaiian Beaches, Leilani Estates, Nānāwale Estates, Kalapana, Seaview Estates, Black Sands Beach Subdivision, Pohoiki, Koaʻe', 96780: 'Papaikou', 96781: 'Paukaʻa', 96783: 'Pepeʻekeo', 96785: 'Volcano' },
  M: { 96708: 'Haʻikū, Peʻahi, Huelo', 96713: 'Hāna, Kīpahulu, Nāhiku', 96729: 'Molokaʻi', 96732: 'Kahului', 96733: 'Kahului', 96742: 'Molokaʻi', 96748: 'Molokaʻi', 96753: 'Kīhei, Wailea, Mākena, Keawakapu',
    96757: 'Molokaʻi', 96761: 'Lahaina, Kāʻanapali, Kahana, Honokahua, Olowalu, Mahinahina Camp, Lahainaluna', 96763: 'Lānaʻi', 96768: 'Makawao, Hāliʻimaile', 96770: 'Molokaʻi',
    96784: 'Puʻunēnē', 96788: 'Pukalani', 96790: 'Kula, Kēōkea, ʻUlupalakua, Waiakoa, Pūlehu, Keāhua', 96793: 'Wailuku, Waiheʻe, Waiʻehu, Waikapū, Māʻalaea, Wailuku Heights, Paukūkalo, Kahakuloa' },
  K: { 96703: 'Anahola', 96705: 'ʻEleʻele', 96714: 'Hanalei, Wainiha, Hāʻena', 96715: 'Hanamāʻulu', 96716: 'Hanapēpē', 96722: 'Princeville', 96741: 'Kalāheo', 96746: 'Kapaʻa, Wailua, Kawaihau',
    96747: 'Pākalā Village', 96751: 'Keālia', 96752: 'Kekaha', 96754: 'Kīlauea', 96756: 'Kōloa, Poʻipū, ʻŌmaʻo', 96765: 'Lāwaʻi', 96766: 'Līhuʻe, Puhi, Kapaia', 96769: 'Niʻihau', 96796: 'Waimea' },
};
function zipTowns(zip) {
  for (const [isl, zips] of Object.entries(ZIPS)) if (zips[zip]) {
    return zips[zip].split(/,\s*/).map(n => placeIndex().get(norm(n) + '|' + isl)).filter(Boolean);
  }
  return null;
}

// ---------------- remembered districts ----------------
function saved() {
  // Districts saved before 9/19 have no island yet: it is worked out from them here, so nothing needs re-saving.
  try { const d = JSON.parse(localStorage.getItem(KEY) || 'null'); if (d && +d.senate && +d.house) return { senate: +d.senate, house: +d.house, label: String(d.label || ''), island: d.island || islandKey(d.senate, d.house, d.label) }; } catch { /* private mode */ }
  const p = S.profile || {};   // signed in, with a home address saved on the account
  if (p.senate_district && p.house_district) return { senate: +p.senate_district, house: +p.house_district, label: 'Your saved address', account: true, island: islandKey(p.senate_district, p.house_district) };
  return null;
}
function remember(pick) {
  const s = pick.ids.map(legById).find(l => l?.chamber === 'S'), h = pick.ids.map(legById).find(l => l?.chamber === 'H');
  // The island rides along (never the street) so Home, the recap and the guided start can highlight it in their art.
  try { if (s && h) localStorage.setItem(KEY, JSON.stringify({ senate: s.district, house: h.district, label: pick.label, island: islandKey(s.district, h.district, pick.town || pick.label) })); } catch { /* private mode */ }
}
function forget() { try { localStorage.removeItem(KEY); } catch { /* ignore */ } }
const mine = (l, d = saved()) => !!d && ((l.chamber === 'S' && l.district === d.senate) || (l.chamber === 'H' && l.district === d.house));
const yoursWord = l => l.chamber === 'S' ? 'Your senator' : 'Your representative';
// A town to put in the email ("I live in Kailua"): never a street address, never a placeholder label.
const townOf = x => x ? x.town || (x.account || /\d/.test(x.label || '') ? '' : x.label || '') : '';

// ---------------- suggestions ----------------
// Ranking (plan 7): with no digits, towns first, then people, then street addresses (a street called "Kailua Blvd"
// on Hawaiʻi Island must never beat the town of Kailua); with digits, districts and addresses first; a ZIP offers its towns.
function suggest(q) {
  const t = q.trim(), k = norm(t);
  if (k.length < 2 && !/^\d$/.test(k)) return [];
  if (/^\d{5}$/.test(t)) {
    const towns = zipTowns(t);
    if (towns?.length) return towns.slice(0, 8).map(p => ({ kind: 'place', label: p.label, sub: `${ISLAND_NAME[p.island]} · ${t}`, island: p.island, ids: placeIds(p) }));
    return [{ kind: /^96[78]\d\d$/.test(t) ? 'zipunknown' : 'nozip' }];
  }
  const digits = /\d/.test(t), out = { place: [], person: [], district: [], addr: [] };
  const dm = /^(senate|house|sen|rep|sd|hd)?\s*(district)?\s*(\d{1,2})$/i.exec(t);
  if (dm) for (const ch of ['S', 'H']) {
    if (dm[1] && (/^(s)/i.test(dm[1]) ? 'S' : 'H') !== ch) continue;
    const who = seated().filter(l => l.chamber === ch && l.district === +dm[3]);
    if (who.length) out.district.push({ kind: 'district', label: `${CHAMBER_WORD[ch]} District ${+dm[3]}`, sub: `${who.map(l => `${legTitle(l)} ${l.name}`).join(', ')} · ${ISLAND_NAME[islandOf(who[0])]}`, ids: who.map(l => l.id) });
  }
  if (!digits) {
    const rank = p => p.key === k ? 0 : p.key.startsWith(k) ? 1 : 2;
    out.place = [...placeIndex().values()].filter(p => (' ' + p.key).includes(' ' + k))
      .sort((a, b) => rank(a) - rank(b) || b.ids.length - a.ids.length || a.label.localeCompare(b.label)).slice(0, 5)
      .map(p => ({ kind: 'place', label: p.label, sub: ISLAND_NAME[p.island], island: p.island, ids: placeIds(p) }));
    out.person = seated().filter(l => (' ' + norm(l.name)).includes(' ' + k) || norm(l.sort_name).startsWith(k)).slice(0, 3)
      .map(l => ({ kind: 'person', label: `${legTitle(l)} ${l.name}`, sub: `${CHAMBER_WORD[l.chamber]} District ${l.district} · ${ISLAND_NAME[islandOf(l)]}`, ids: [l.id] }));
  }
  out.addr = AP.results(t).slice(0, digits ? 8 : 4).map(addrSug);
  if (digits && /^\d/.test(t) && t.length >= 5 && !out.addr.some(x => x.exact)) out.addr.push({ kind: 'typed', label: 'Look up this address', sub: t, q: t });
  return (digits ? [...out.district, ...out.addr, ...out.place, ...out.person] : [...out.place, ...out.person, ...out.addr]).slice(0, 10);
}
// "445 N Kainalu Dr, Kailua 96734" -> street, and the town as the directory spells it; no town -> the island.
function addrSug(x) {
  let [street, rest = ''] = String(x.label || '').replace(/\s+/g, ' ').trim().split(/,\s*/);
  if (street && street === street.toUpperCase()) street = titleWords(street);   // the address table shouts some streets: "445 N KAINALU DR"
  const isl = x.sd ? islandOfSeat('S', x.sd) : x.hd ? islandOfSeat('H', x.hd) : '';
  const town0 = rest.replace(/\s*\d{5}$/, '').trim(), town = town0 ? (placeIndex().get(norm(town0) + '|' + isl)?.label || titleWords(town0)) : '';
  const sub = [town || ISLAND_NAME[isl] || '', x.exact === false ? 'closest match' : ''].filter(Boolean).join(' · ');
  return { kind: 'addr', ...x, label: [street, town].filter(Boolean).join(', '), street, town, sub };
}
const titleWords = s => s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
const SUG_ICON = { place: 'house', addr: 'map-pin', typed: 'map-pin', person: 'user', district: 'map' };
function sugHTML() {
  const list = P.pick ? [] : suggest(P.q);
  if (list.length === 1 && list[0].kind === 'nozip') return `<p class="pp-sugnote">${icon('info')}<span>That ZIP code is not in Hawaiʻi. Try your street address or your town.</span></p>`;
  if (list.length === 1 && list[0].kind === 'zipunknown') return `<p class="pp-sugnote">${icon('info')}<span>That ZIP code is for post office boxes. Try your street address or your town.</span></p>`;
  const rows = list.map((x, i) => `<button type="button" class="pp-sugrow" data-pp-sug="${i}"><span class="pp-sugic">${icon(SUG_ICON[x.kind])}</span><span class="pp-sugtext"><span class="pp-sugtitle">${esc(x.kind === 'addr' ? x.street : x.label)}</span>${x.sub ? `<span class="pp-sugsub">${esc(x.sub)}</span>` : ''}</span></button>`).join('');
  const wait = AP.isLoading() && looksLikeAddress(P.q) && (/\d/.test(P.q) || !list.length) ? `<p class="pp-sugnote" aria-hidden="true">${icon('loader-circle', { cls: 'pp-spin' })}<span>Looking up street addresses…</span></p>` : '';
  return rows || wait ? `<div class="pp-sugs" role="group" aria-label="Suggestions">${rows}${wait}</div>` : '';
}

// ---------------- the email ----------------
const me = () => { try { return JSON.parse(localStorage.getItem('hiphi_me') || '{}') || {}; } catch { return {}; } };
const surname = l => (l.sort_name || l.name).split(',')[0].trim();
// Ported from legDraft in track.js: the person's own name and town when the testimony helper has them, a bill in
// plain words when they came from one, and a blank line for their own reason (the part lawmakers read closely).
function draft(l, b, where) {
  const m = me(), p = b && posInfo(b), town = m.town || where || '';
  const verb = !p ? 'consider' : p.verb === 'comment on' ? 'consider' : p.verb;
  const lines = [`Aloha ${legTitle(l)} ${surname(l)},`,
    `My name is ${m.name || '[your name]'} and I live in ${town || '[your town]'}${mine(l) ? ', in your district' : ''}.`];
  // core's blurb() drops the Capitol's drafting notes ("Effective 3/22/2075. (SD1)") and ends at a sentence. Summaries
  // start with a verb ("Requires free school bus passes…"), so they read on after the bill number: "HB 1780, which requires…".
  const about = b && blurb(b, 320).split(/(?<=\.)\s+(?=[A-Z])/)[0].replace(/[.…\s]+$/, '');
  const says = !about ? '' : /^[A-Z][a-z]+s\b/.test(about) && !/^(This|These|The|A|An)\b/.test(about) ? `, which ${about.charAt(0).toLowerCase()}${about.slice(1)}.` : `. ${about}.`;
  if (b) lines.push(`I am writing about ${spaced(b.bill_number)}${says || '.'}${b.hiphi_action ? ' ' + b.hiphi_action.trim().replace(/([^.!?])$/, '$1.') : ''} I hope you will ${verb} it.`);
  else lines.push('I am writing to introduce myself. I care about the health of our community, and I would like to share my views with you as bills come up.');
  lines.push((m.why || '').trim() ? m.why.trim().replace(/([^.!?])$/, '$1.') : '[Why this matters to you, in a sentence or two.]');
  lines.push(`Mahalo,\n${m.name || '[your name]'}`);
  const subject = b ? `${spaced(b.bill_number)}: please ${verb} it` : `A note from ${town ? 'a neighbor in ' + town : 'a constituent'}`;
  return { subject, body: lines.join('\n\n') };
}
const mailto = (l, subject, body) => `mailto:${l.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
function composer(l, b, k, where) {
  const d = draft(l, b, where), text = P.text[k] ?? d.body, asked = P.sent[k] && b;
  return `<div class="pp-cmp" id="pp-cmp-${k}">
    <p class="small"><span class="strong">To:</span> ${esc(legTitle(l))} ${esc(l.name)}, <span class="pp-email">${esc(l.email)}</span></p>
    <p class="small"><span class="strong">Subject:</span> ${esc(d.subject)}</p>
    <div class="field"><label for="pp-msg-${k}">Your message</label>
      <textarea id="pp-msg-${k}" data-pp-msg="${k}" rows="11" aria-describedby="pp-help-${k}">${esc(text)}</textarea>
      <span class="help" id="pp-help-${k}">Change anything you like. A sentence in your own words carries the most weight.</span></div>
    ${asked ? `<div class="pp-sentq" role="group" aria-label="Did you send it?"><span class="strong">Did you send it?</span>
        <div class="btnrow">${btn('Yes, I sent it', { kind: 'primary', sm: true, attrs: { 'data-pp-sentyes': k } })}${btn('Not yet', { kind: 'text', sm: true, attrs: { 'data-pp-sentno': k } })}</div></div>`
      : `<div class="btncol">${btn('Open in my mail app', { kind: 'primary', icon: 'send', full: true, href: mailto(l, d.subject, text), attrs: { 'data-pp-mailto': k } })}
        <div class="btnrow pp-copies">${btn('Copy message', { kind: 'text', sm: true, icon: 'copy', attrs: { 'data-pp-copy': 'msg', 'data-k': k } })}${btn('Copy address', { kind: 'text', sm: true, icon: 'at-sign', attrs: { 'data-pp-copy': l.email, 'data-k': k } })}
          <span class="pp-copied" role="status">${P.copied === k ? chip('Copied', 'ok', 'check') : ''}</span></div></div>`}
  </div>`;
}
// Email and Call, side by side. On the finder they are both quiet; the mail app button inside is the one primary.
function contact(l, k, { primary = false } = {}) {
  const open = P.mail === k, last = `${legTitle(l)} ${surname(l)}`;
  const email = l.email ? btn(open ? 'Hide email' : primary ? `Email ${last}` : 'Email', { kind: primary && !open ? 'primary' : 'secondary', sm: !primary, icon: open ? 'x' : 'mail',
    attrs: { 'data-pp-mail': k, 'aria-expanded': open ? 'true' : 'false', 'aria-controls': 'pp-cmp-' + k } }) : '';
  const call = l.phone ? btn(primary ? `Call ${l.phone}` : 'Call', { kind: 'secondary', sm: !primary, icon: 'phone', href: `tel:${l.phone.replace(/[^\d+]/g, '')}`, attrs: { 'aria-label': `Call ${last} at ${l.phone}` } }) : '';
  return email || call ? `<div class="${primary ? 'btncol' : 'pp-contact'}">${email}${call}</div>` : '';
}

// ---------------- where people come from ----------------
const billNum = r => /^(HB|SB|HCR|SCR|HR|SR|GM)\d+$/i.test(r?.from || '') ? r.from.toUpperCase() : '';
const legHref = (id, from) => `#/legislator/${id}${from ? '?from=' + encodeURIComponent(from) : ''}`;
// The bill someone came from, for "Back to HB 1563" and so the email is about it. Loaded once if not on hand.
function fromBill(num) {
  if (!num) return null;
  const b = [...(S.bills || []), ...Object.values(S.extra || {})].find(x => x.bill_number === num);
  if (b) return b;
  if (!P.bills[num]) { P.bills[num] = 'loading'; ensureBill(num).then(x => { P.bills[num] = x || 'none'; if (x) app.render(); }).catch(() => { P.bills[num] = 'none'; }); }
  return typeof P.bills[num] === 'object' ? P.bills[num] : null;
}
const backLink = (href, label) => `<a class="btn text pp-back" href="${esc(href)}">${icon('arrow-left')}<span>${esc(label)}</span></a>`;

// ---------------- the finder ----------------
function finderPage(route) {
  const from = billNum(route), b = fromBill(from), sv = saved();
  if (!seated().length) return `<div class="pp">${from ? backLink('#/bill/' + from, `Back to ${spaced(from)}`) : ''}
    <div class="pagehead"><h1 class="hero">Your legislators</h1></div>${notice('bad', 'circle-alert', 'We couldn’t load the list of legislators. Check your connection and try again.')}
    <div class="pp-retry">${btn('Try again', { kind: 'primary', icon: 'rotate-ccw', attrs: { 'data-pp-reload': '' } })}</div></div>`;
  const pick = P.pick || (!P.changing && sv ? savedPick(sv) : null);
  return `<div class="pp pp-finder">
    ${from ? backLink('#/bill/' + from, `Back to ${spaced(from)}`) : ''}
    <div class="pagehead"><h1 class="hero">Your legislators</h1>
      <p class="lede">Find the two people who represent you: one senator and one representative.</p></div>
    ${P.finding ? findingHTML() : pick ? resultHTML(pick, b, from) : searchHTML(sv)}
    ${browseHTML(from, pick)}
  </div>`;
}
const savedPick = sv => ({ kind: 'saved', label: sv.label, ids: forDistricts(sv.senate, sv.house).map(l => l.id) });
function searchHTML(sv) {
  return `<form class="pp-search" id="pp-form" role="search" novalidate>
      <div class="field"><label for="pp-q">Your street address or town</label>
        <div class="searchbox">${icon('search')}
          <input id="pp-q" type="text" value="${esc(P.q)}" placeholder="Street address or town, e.g. Kailua" autocomplete="street-address" autocapitalize="words"
            spellcheck="false" enterkeyhint="search" aria-describedby="pp-qhelp${P.err ? ' pp-err' : ''}"${P.err ? ' aria-invalid="true"' : ''}>
          <button type="button" class="iconbtn clear" data-pp-clear aria-label="Clear"${P.q ? '' : ' hidden'}>${icon('x')}</button></div>
        <span class="help" id="pp-qhelp">We use it only to look up your districts. It is not saved.</span></div>
      ${P.err ? inlineErr('pp-err', P.err) : ''}
      <div id="pp-sug">${sugHTML()}</div>
      <p class="sr" id="pp-sugstat" role="status"></p>
    </form>
    ${sv && P.changing ? `<p class="pp-savedline">${icon('map-pin')}<span>Saved on this device: <span class="strong">${esc(sv.label || 'your districts')}</span></span>${btn('Show', { kind: 'text', sm: true, attrs: { 'data-pp-show': '' } })}</p>` : ''}`;
}
const findingHTML = () => `<div class="pp-finding" role="status">${icon('loader-circle', { cls: 'pp-spin' })}<span>Finding the districts for <span class="strong">${esc(P.finding)}</span>…</span></div>
  <div class="pp-skel grid2" aria-hidden="true"><div class="skel"></div><div class="skel"></div></div>`;

// Two slots, always: Senator and Representative. An address fills both. A town can fill one, both, or neither
// (district lines split towns, and neighbour-island Senate districts name regions, not towns), and then we ask
// for the street instead of guessing.
function resultHTML(pick, b, from) {
  const legs = pick.ids.map(legById).filter(l => l && seatCache.ids.has(l.id));
  const sen = legs.filter(l => l.chamber === 'S').sort(bySeat), rep = legs.filter(l => l.chamber === 'H').sort(bySeat);
  const exact = sen.length === 1 && rep.length === 1, where = townOf(pick), label = pick.display || pick.label || 'Your districts';
  const split = [sen, rep].some(x => x.length > 1), none = [sen, rep].filter(x => !x.length).map(x => x === sen ? 'senator' : 'representative');
  const why = !exact ? (split ? `${esc(pick.label)} is split between districts, so it depends on your street.` : `The town alone doesn’t tell us your ${none.join(' or ')}. Your street address will.`) : '';
  const slot = (list, ch) => {
    const word = ch === 'S' ? 'senator' : 'representative', Word = ch === 'S' ? 'Senators' : 'Representatives';
    if (list.length === 1) return bigCard(list[0], { eyebrow: exact ? yoursWord(list[0]) : `${ch === 'S' ? 'Senator' : 'Representative'} for ${pick.label}`, b, from, where });
    // Neighbour-island Senate districts name regions ("South Maui"), not towns: show the island's few senators.
    const isl = !list.length && pick.island ? seated().filter(l => l.chamber === ch && islandOf(l) === pick.island).sort(bySeat) : [];
    if (isl.length > 1 && isl.length <= 4) return `<div class="card pp-slot"><p class="pp-eyebrow">${Word} for ${esc(ISLAND_NAME[pick.island])}</p>
      <p class="small muted">One of these is yours. Your street address tells which.</p>
      <div class="pp-list">${isl.map(l => lrow(l, from)).join('')}</div></div>`;
    if (!list.length) return `<div class="card pp-slot"><p class="pp-eyebrow">Your ${word}</p><p class="small muted">Type your street address above to find your ${word}.</p></div>`;
    return `<div class="card pp-slot"><p class="pp-eyebrow">${Word} for ${esc(pick.label)}</p>
      <p class="small muted">One of these is yours. Your street address tells which.</p>
      <div class="pp-list">${list.map(l => lrow(l, from)).join('')}</div></div>`;
  };
  return `<section class="pp-result" aria-labelledby="pp-for">
    <div class="pp-for">${icon(pick.kind === 'place' ? 'house' : 'map-pin')}<h2 id="pp-for" tabindex="-1"><span class="sr">Results for </span>${esc(label)}</h2>
      ${btn('Change', { kind: 'text', sm: true, icon: 'pencil', attrs: { 'data-pp-change': '' } })}</div>
    ${exact ? `<p class="pp-intro">They work for you. A short, friendly note from someone in their district gets read.</p>`
      : `<div class="pp-notice">${notice('info', 'info', `<p>${why}</p>`)}${btn('Use my street address', { kind: 'secondary', icon: 'map-pin', full: true, attrs: { 'data-pp-street': '' } })}</div>`}
    <div class="pp-slots grid2${P.mail ? ' pp-writing' : ''}">${slot(sen, 'S')}${slot(rep, 'H')}</div>
    ${exact ? `<label class="check pp-remember"><input type="checkbox" id="pp-remember"${P.remember ? ' checked' : ''} aria-describedby="pp-remhelp">
      <span><span class="strong">Remember on this device</span><span class="help" id="pp-remhelp">Bill pages will point out your senator and representative. Saved only on this device.</span></span></label>` : ''}
    ${exact && pick.kind === 'place' ? `<p class="pp-fine">${icon('info')}<span>Found by town. District lines can split a town, so your street address is the surest way.</span></p>` : ''}
  </section>`;
}
function bigCard(l, { eyebrow, b, from, where }) {
  const k = 'c' + l.id;
  return `<article class="card pp-card" aria-labelledby="pp-n${l.id}">
    <div class="pp-who">${legPhoto(l, 'pp-photo')}<div class="pp-whotext">
      <p class="pp-eyebrow">${esc(eyebrow)}</p>
      <h3 class="pp-name" id="pp-n${l.id}"><a href="${legHref(l.id, from)}">${esc(legTitle(l))} ${esc(l.name)}</a></h3>
      <p class="meta">${CHAMBER_WORD[l.chamber]} District ${l.district}${PARTY[l.party] ? ' · ' + PARTY[l.party] : ''}</p></div></div>
    ${l.places ? `<p class="pp-covers">Covers ${esc(cover(l))}</p>` : ''}
    ${contact(l, k)}
    ${P.mail === k ? composer(l, b, k, where) : ''}
    <a class="pp-more" href="${legHref(l.id, from)}"><span>See their committees</span>${icon('chevron-right')}</a>
  </article>`;
}
const lrow = (l, from, sv) => row({ leadHtml: legPhoto(l, 'pp-photo sm'), title: `${esc(legTitle(l))} ${esc(l.name)}`,
  sub: `District ${l.district}${l.places ? ' · ' + esc(okina(l.places)) : ''}`, end: mine(l, sv) ? chip('Yours', 'info') : '', href: legHref(l.id, from), cls: 'pp-lrow' });

// Browse: an island picker drawn with the island chain (each button lights up its own island), then that island's
// senators and representatives. One island at a time, so the list never runs to 18,000px. On a phone the picker is
// four rows and the list is one column; on a wide screen the picker is four cards and the list a three-column grid.
function browseHTML(from, pick) {
  const sv = saved();
  // The person's island, when we know it: from the districts they saved, or from the result on screen.
  const leg0 = pick && pick.ids.map(legById).find(Boolean), home = sv ? ART_KEY_CODE[sv.island] || '' : leg0 && pick.ids.length <= 2 ? islandOf(leg0) : '';
  const cards = ISLANDS.map(([c, name, sub]) => {
    const ls = seated().filter(l => islandOf(l) === c), ns = ls.filter(l => l.chamber === 'S').length, nr = ls.length - ns, on = P.isl === c;
    return `<button type="button" class="pp-isle${on ? ' on' : ''}" data-pp-isl="${c}" aria-expanded="${on}" aria-controls="pp-islbody">
      <span class="pp-isleart">${islands(c === 'M' ? 'mauicounty' : c === 'K' ? 'kauaicounty' : ART_KEY[c])}</span>
      <span class="pp-isletext"><span class="pp-isletitle">${name}${home === c ? ` ${chip('Your island', 'info')}` : ''}</span>
        <span class="pp-islesub">${sub ? sub + ' · ' : ''}${ns} senator${ns === 1 ? '' : 's'}, ${nr} representative${nr === 1 ? '' : 's'}</span></span>
      ${icon('chevron-down', { cls: 'pp-chev' })}</button>`;
  }).join('');
  let body = '';
  if (P.isl) {
    const ls = seated().filter(l => islandOf(l) === P.isl), sen = ls.filter(l => l.chamber === 'S').sort(bySeat), rep = ls.filter(l => l.chamber === 'H').sort(bySeat);
    body = `<h3 class="pp-islname" id="pp-islname" tabindex="-1">${ISLAND_NAME[P.isl]}</h3>
      <h4 class="pp-ch">Senators</h4><div class="pp-list pp-grid">${sen.map(l => lrow(l, from, sv)).join('')}</div>
      <h4 class="pp-ch">Representatives</h4><div class="pp-list pp-grid">${rep.map(l => lrow(l, from, sv)).join('')}</div>`;
  }
  return `<section class="pp-browse" aria-labelledby="pp-br-t">
    <div class="sechead"><h2 id="pp-br-t">Browse all legislators</h2><span class="meta">Choose an island</span></div>
    <div class="pp-isles" role="group" aria-label="Islands">${cards}</div>
    <div class="pp-islbody" id="pp-islbody">${body}</div>
  </section>`;
}
const ART_KEY_CODE = { oahu: 'O', hawaii: 'H', maui: 'M', molokai: 'M', lanai: 'M', kahoolawe: 'M', kauai: 'K', niihau: 'K' };

// ---------------- one legislator ----------------
const ROLE = { chair: 0, vice_chair: 1, member: 2 };
const roleWord = r => ({ chair: 'Chair', vice_chair: 'Vice chair', member: 'Member' })[r] || 'Member';
const rolesOf = l => (S.committeeMembers || []).filter(m => m.legislator_id === l.id).sort((a, b) => ROLE[a.role] - ROLE[b.role] || cmteLabel(a.committee).localeCompare(cmteLabel(b.committee)));
// hearingsOf(b) only ever knows about a followed bill's hearings (S.hearings) or one loaded for a
// single unfollowed bill by link (S.xh). A legislator's committee list now scans every live position
// bill (S.pool.bills, below), most of which are neither - so an upcoming hearing on one of those has
// to come from S.pool.hearings instead, merged in rather than replacing hearingsOf's own sources.
const poolHearingsOf = b => {
  const extra = ((S.pool && S.pool.hearings) || []).filter(h => h.bill_id === b.id);
  return extra.length ? [...new Map([...hearingsOf(b), ...extra].map(h => [h.id, h])).values()] : hearingsOf(b);
};
// Where a bill stands with one legislator's committees: in one now (or heard there soon), or in one it goes to next
// in the same chamber. The referral list is the whole path; origin_stops splits it between the two chambers.
function billAt(b, roles) {
  if (!alive(b)) return null;
  const st = stopOf(b), now = Date.now(), refs = b.referrals || [], n = b.origin_stops || refs.length;
  const here = [...codesOf(st.committee), ...poolHearingsOf(b).filter(h => h.status === 'scheduled' && new Date(h.scheduled_at) > now).flatMap(h => codesOf(h.committee))];
  const leg = st.leg === 'second' ? refs.slice(n) : refs.slice(0, n), i = leg.findIndex(c => codesOf(c).some(x => here.includes(x)));
  const next = i >= 0 ? leg.slice(i + 1).flatMap(codesOf) : [];
  const r1 = roles.find(r => here.includes(r.committee)); if (r1) return { r: r1, when: 'now' };
  const r2 = roles.find(r => next.includes(r.committee)); return r2 ? { r: r2, when: 'next' } : null;
}
// Every live bill HIPHI has a position on that touches one of their committees, not just the ones the
// visitor happens to follow (that was the bug: a visitor with no follows saw an empty section here).
// Followed bills join the pool so a followed monitor-position bill - excluded from S.pool.bills - still
// shows. Sorted "now" before "next", and chair before vice-chair before member within each.
function billsIn(roles) {
  const all = new Map();
  for (const b of S.bills || []) all.set(b.id, b);
  for (const b of (S.pool && S.pool.bills) || []) if (!all.has(b.id)) all.set(b.id, b);
  return [...all.values()].map(b => ({ b, ...billAt(b, roles) })).filter(x => x.r)
    .sort((x, y) => (x.when === 'now' ? 0 : 1) - (y.when === 'now' ? 0 : 1) || ROLE[x.r.role] - ROLE[y.r.role]);
}
const roleThe = r => r.role === 'chair' ? 'the chair' : r.role === 'vice_chair' ? 'the vice chair' : 'a member';
function personPage(route) {
  const l = legById(route.id), from = billNum(route), b = fromBill(from);
  if (!l) return `<div class="pp">${backLink('#/legislators', 'All legislators')}${empty({ title: 'We couldn’t find that legislator', text: 'The link may be old. Every senator and representative is on the Legislators page.', action: btn('See all legislators', { kind: 'primary', href: '#/legislators' }) })}</div>`;
  const sv = saved(), k = 'p' + l.id, roles = rolesOf(l), committeeBills = billsIn(roles), last = `${legTitle(l)} ${surname(l)}`;
  const onBill = b && billAt(b, roles), yours = mine(l) ? chip(yoursWord(l), 'info', 'user-check') : '';
  const chamber = l.chamber === 'S' ? 'Senate' : 'House';
  const billName = b ? `${esc(spaced(b.bill_number))}${nick(b) ? ` (${esc(nick(b))})` : ''}` : '';
  // A bill leads with its everyday name when staff have written one; what it does is the second line.
  const billRow = ({ b: x, r, when }) => {
    const meta = `${esc(spaced(x.bill_number))} · ${when === 'now' ? esc(plainStatus(x).short) : 'Comes to their committee next'}${r.role === 'chair' ? ` · ${when === 'now' ? 'they chair it' : 'they chair that committee'}` : ''}`;
    const end = S.watch.has(x.id) ? chip('Following', 'info', 'star') : '';
    return row({ title: esc(nick(x) || blurb(x, 160)), sub: nick(x) ? `<span class="pp-what">${esc(blurb(x, 160))}</span><span>${meta}</span>` : meta, end, href: billPath(x), cls: 'pp-billrow' });
  };
  // One page, two layouts. On a phone everything stacks: who they are, how to reach them, then their committees.
  // From 1100px the contact panel moves to the side and stays in view (wide.css .cols + .side), with "Your senator"
  // on it, and the email opens in the wide column where there is room to write.
  return `<div class="pp pp-person">
    ${backLink(from ? '#/bill/' + from : '#/legislators', from ? `Back to ${spaced(from)}` : 'All legislators')}
    <div class="cols pp-cols">
      <div class="pp-main">
        <header class="pp-prof">${legPhoto(l, 'pp-photo xl')}
          <div class="pp-proftext">${yours ? `<span class="pp-yours-top">${yours}</span>` : ''}
            <h1 class="hero">${esc(legTitle(l))} ${esc(l.name)}</h1>
            <p class="pp-role">${chamber} District ${l.district}${PARTY[l.party] ? ' · ' + PARTY[l.party] : ''}${l.title ? ' · ' + esc(l.title) : ''}</p></div></header>
        ${l.places ? `<p class="pp-covers">Covers ${esc(cover(l))}</p>` : ''}
        ${b && l.email ? `<div class="pp-about">${notice('info', 'mail', `<p>${onBill ? `${esc(last)} is ${roleThe(onBill.r)} of the committee ${onBill.when === 'now' ? `that has ${esc(spaced(b.bill_number))} now` : `${esc(spaced(b.bill_number))} goes to next`}. ` : ''}The email is about ${billName}.</p>`)}</div>` : ''}
      </div>
      <aside class="side pp-side" aria-label="Contact ${esc(last)}">
        <div class="pp-sidecard">
          ${yours ? `<span class="pp-yours-side">${yours}</span>` : ''}
          <h2 class="pp-sidehead">Get in touch</h2>
          <div class="pp-actions">${contact(l, k, { primary: true })}</div>
          ${l.room || l.phone ? `<p class="pp-office">${icon('landmark')}<span>Office: ${l.room ? `Room ${esc(l.room)}, ` : ''}Hawaiʻi State Capitol${l.phone ? `, ${esc(l.phone)}` : ''}</span></p>` : ''}
          ${l.capitol_url ? `<p class="pp-ext">${btn('Their page on the Capitol website', { kind: 'text', sm: true, icon: 'external-link', href: l.capitol_url, attrs: { target: '_blank', rel: 'noopener' } })}</p>` : ''}
        </div>
      </aside>
      <div class="pp-rest">
        ${P.mail === k ? composer(l, b, k, mine(l, sv) ? townOf(sv) : '') : ''}
        ${roles.length ? `<section class="pp-sec" aria-labelledby="pp-cm"><h2 id="pp-cm">Committees</h2>
          <p class="pp-explain">Committees look at bills before the full ${chamber} votes. The chair decides which bills get a hearing.</p>
          <ul class="pp-cmtes">${roles.map(r => `<li>${icon(r.role === 'member' ? 'users' : 'landmark')}<span><span class="strong">${roleWord(r.role)}</span> of the ${esc(cmteLabel(r.committee))}</span></li>`).join('')}</ul></section>` : ''}
        ${committeeBills.length ? `<section class="pp-sec" aria-labelledby="pp-fb"><h2 id="pp-fb">Bills in their committees</h2>
          <div class="rows">${committeeBills.map(billRow).join('')}</div></section>` : ''}
      </div>
    </div>
  </div>`;
}

// ---------------- wiring ----------------
const $ = s => document.querySelector(s);
function paintSug() {
  const box = $('#pp-sug'); if (!box) return;
  box.innerHTML = sugHTML(); wireSug();
  const n = box.querySelectorAll('[data-pp-sug]').length, stat = $('#pp-sugstat');
  if (stat) stat.textContent = P.q.trim().length >= 2 ? (n ? `${n} suggestion${n === 1 ? '' : 's'}` : '') : '';
}
function wireSug() {
  document.querySelectorAll('[data-pp-sug]').forEach((el, i, all) => {
    el.onclick = () => choose(suggest(P.q)[+el.dataset.ppSug]);
    el.onkeydown = e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); (all[i + 1] || all[i]).focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); (all[i - 1] || $('#pp-q')).focus(); }
      else if (e.key === 'Escape') { e.preventDefault(); $('#pp-q')?.focus(); }
    };
  });
}
function onType(v) {
  P.q = v; P.err = ''; P.pick = null;
  const clear = $('[data-pp-clear]'); if (clear) clear.hidden = !v;
  const inp = $('#pp-q'); if (inp) { inp.removeAttribute('aria-invalid'); $('#pp-err')?.remove(); }
  // Street addresses come from the database: AP waits for a pause in typing. A ZIP alone has no street to match.
  AP.search(v.trim(), paintSug);
  paintSug();
}
async function choose(x) {
  if (!x || /zip/.test(x.kind)) return;
  // A person or a district is someone to look up, not "your legislators": open their page.
  if (x.kind === 'person' || (x.kind === 'district' && x.ids.length === 1)) { app.go(legHref(x.ids[0], P.from)); return; }
  if (x.kind === 'place' || x.kind === 'district') { setPick({ kind: 'place', label: x.label, ids: x.ids, island: x.island }); return; }
  P.finding = x.kind === 'addr' ? x.street : x.q; P.err = ''; app.render();
  try {
    const r = await legLookupAddress(x.q || x.label, x.kind === 'addr' ? x : null);
    P.finding = null;
    if (!r || r.none || !r.ids?.length) { P.err = 'We couldn’t find that address. Try the house number, street and town, like 45 Kainalu Dr, Kailua. Or pick your town from the list.'; app.render(); $('#pp-q')?.focus(); return; }
    const a = x.kind === 'addr' ? x : addrSug({ label: r.matched || x.q });
    setPick({ kind: 'addr', label: a.town || a.street || r.matched, display: a.label || r.matched, town: a.town, ids: r.ids });
  } catch {
    P.finding = null; P.err = 'We couldn’t look that up. Check your connection and try again, or pick your town instead.'; app.render();
  }
}
function setPick(pick) {
  P.pick = pick; P.changing = false; P.mail = null; P.q = '';
  const legs = pick.ids.map(legById).filter(l => l && seated().includes(l));
  pick.ids = legs.map(l => l.id);
  if (P.remember && legs.filter(l => l.chamber === 'S').length === 1 && legs.filter(l => l.chamber === 'H').length === 1) remember(pick);
  app.render();
  // Move to the answer: the keyboard closes and a screen reader hears where the results are for.
  requestAnimationFrame(() => { const h = $('#pp-for'); if (!h) return; h.focus({ preventScroll: true }); h.closest('.pp-result')?.scrollIntoView({ block: 'nearest' }); });
}
async function copy(text, k, ta) {
  let ok = false;
  try { await navigator.clipboard.writeText(text); ok = true; } catch { if (ta) { ta.focus(); ta.select(); try { ok = document.execCommand('copy'); } catch { ok = false; } } }
  const spot = document.querySelector(`#pp-cmp-${k} .pp-copied`);
  P.copied = ok ? k : null;
  if (spot) spot.innerHTML = ok ? chip('Copied', 'ok', 'check') : `<span class="small">Select the text and copy it.</span>`;
  clearTimeout(copy.t); copy.t = setTimeout(() => { P.copied = null; if (spot?.isConnected) spot.innerHTML = ''; }, 2500);
}
function wire(route) {
  const root = $('.pp'); if (!root) return;
  const from = P.from = billNum(route);
  const form = $('#pp-form'), inp = $('#pp-q');
  if (form) form.onsubmit = e => {
    e.preventDefault();
    const list = suggest(P.q).filter(x => !/zip/.test(x.kind));
    if (list.length) choose(list[0]);
    else if (P.q.trim().length >= 5 && looksLikeAddress(P.q)) choose({ kind: 'typed', q: P.q.trim() });
    else { P.err = P.q.trim() ? 'Try a street address with the town, like 45 Kainalu Dr, Kailua, or just your town.' : 'Type your street address or your town.'; app.render(); $('#pp-q')?.focus(); }
  };
  if (inp) {
    inp.oninput = () => onType(inp.value);
    inp.onkeydown = e => { if (e.key === 'ArrowDown') { const f = document.querySelector('[data-pp-sug]'); if (f) { e.preventDefault(); f.focus(); } } };
  }
  $('[data-pp-clear]') && ($('[data-pp-clear]').onclick = () => { if (inp) { inp.value = ''; onType(''); inp.focus(); } });
  wireSug();
  const again = () => { P.pick = null; P.changing = true; P.q = ''; P.err = ''; P.mail = null; app.render(); requestAnimationFrame(() => $('#pp-q')?.focus()); };
  root.querySelectorAll('[data-pp-change], [data-pp-street]').forEach(el => el.onclick = again);
  $('[data-pp-show]') && ($('[data-pp-show]').onclick = () => { P.changing = false; P.pick = null; app.render(); });
  $('[data-pp-reload]') && ($('[data-pp-reload]').onclick = () => location.reload());
  const rem = $('#pp-remember');
  if (rem) rem.onchange = () => {
    P.remember = rem.checked;
    const sv = saved();
    if (!P.pick && sv) P.pick = savedPick(sv);   // keep showing these two after forgetting them
    if (rem.checked && P.pick) remember(P.pick); else forget();
    const help = $('#pp-remhelp'); if (help) help.textContent = rem.checked ? 'Saved on this device. Bill pages will point out your senator and representative.' : 'Not saved. We will ask again next time.';
  };
  // Email: one composer open at a time, the person's edits kept while they stay on the page.
  root.querySelectorAll('[data-pp-mail]').forEach(el => el.onclick = () => {
    const k = el.dataset.ppMail; P.mail = P.mail === k ? null : k; app.render();
    requestAnimationFrame(() => { document.querySelector(`[data-pp-mail="${k}"]`)?.focus({ preventScroll: true });
      if (P.mail === k) document.getElementById('pp-cmp-' + k)?.scrollIntoView({ block: 'nearest' }); });
  });
  root.querySelectorAll('[data-pp-msg]').forEach(ta => {
    const grow = () => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 2 + 'px'; };
    grow();
    ta.oninput = () => { const k = ta.dataset.ppMsg; P.text[k] = ta.value; grow();
      const a = document.querySelector(`[data-pp-mailto="${k}"]`); if (a) a.href = a.href.replace(/&body=.*$/, '&body=' + encodeURIComponent(ta.value)); };
  });
  root.querySelectorAll('[data-pp-copy]').forEach(el => el.onclick = () => {
    const k = el.dataset.k, ta = document.getElementById('pp-msg-' + k);
    copy(el.dataset.ppCopy === 'msg' ? (ta?.value || '') : el.dataset.ppCopy, k, el.dataset.ppCopy === 'msg' ? ta : null);
  });
  // With a bill, sending counts as an action on it (every action counts); a hello with no bill is just a hello.
  root.querySelectorAll('[data-pp-mailto]').forEach(el => el.addEventListener('click', () => {
    const b = fromBill(from); if (!b) return;
    setTimeout(() => { P.sent[el.dataset.ppMailto] = true; app.render(); }, 600);
  }));
  root.querySelectorAll('[data-pp-sentyes]').forEach(el => el.onclick = () => {
    const b = fromBill(from), k = el.dataset.ppSentyes; P.sent[k] = false; P.mail = null;
    if (b) { markDone(b.id, null, 'email', true, { quiet: true }); yay('Mahalo! Lawmakers listen closely to people from their own district.'); }
    app.render();
  });
  root.querySelectorAll('[data-pp-sentno]').forEach(el => el.onclick = () => { P.sent[el.dataset.ppSentno] = false; app.render(); });
  // The island picker: one island open at a time; choosing the open one again closes it. The button keeps keyboard
  // focus (app.js puts it back after the redraw). If the list opened out of sight, the picker moves to the top of
  // the screen so the island's name and first rows show under it.
  root.querySelectorAll('[data-pp-isl]').forEach(el => el.onclick = () => {
    const c = el.dataset.ppIsl; P.isl = P.isl === c ? null : c; app.render();
    if (!P.isl) return;
    requestAnimationFrame(() => {
      const body = document.getElementById('pp-islbody'), sec = body?.closest('.pp-browse'); if (!body) return;
      if (body.getBoundingClientRect().top > window.innerHeight - 260) sec.querySelector('.pp-isles').scrollIntoView({ block: 'start', behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    });
  });
}

export default {
  tab: 'more',
  title: route => {
    if (route.name === 'legislator') { const l = legById(route.id); return l ? `${legTitle(l)} ${l.name}` : 'Legislator'; }
    return 'Your legislators';
  },
  render(route) {
    // Coming back to a page keeps what was found this visit; an open email or an old error does not linger.
    if (P.lastRoute !== route.name + (route.id || '')) { P.mail = null; P.err = ''; }
    P.lastRoute = route.name + (route.id || '');
    return route.name === 'legislator' ? personPage(route) : finderPage(route);
  },
  wire,
};
