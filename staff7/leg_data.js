// Legislators (R-398 piece 12, part 1): everything the Legislators list, the Directory and the legislator page need to KNOW, as plain functions over the practice data (S). No HTML here:
// leg_dir.js, legislators.js and the page files (part 3) draw it. The grouping logic is the drawings' (docs/requests/R-398-leg/draw/render_opts.js), ported so it can be reused.
//   people:   allLegs() legOf(id) surnameOf(l) metaLine(l) seatsOf(id) seatText(s) roleLine(l) towns(l) phoneHref(l)
//   our bills: ourBills(l, me) -> { chair, vice, intro, sit, all, yours, team }    isYours(b, me)    leadName(b)    whereWords(b)
//   page data: nowItems(l, view, me, opts) asksOf(l) testimonyOf(l) stanceOf(l, b) notesOf(l) latestTalk(l)
//   the list:  yoursIds(me) contactName(l, me) findLegs(q) listGroups(me, mode, ids) directorySections(view, ids)
import { S } from '../staff6/data.js';
import * as m from '../staff6/model.js';
import * as bw from './bill_words.js';
import * as pl from './place.js';
import { billNo, billName } from './steps.js';
import { askKey } from './ask_data.js';
import { dateWords } from './words.js';

export const plain = n => String(n || '').replace(/\s*&\s*/g, ' and ');   // the app says "and", never "&"
export const eCig = t => String(t || '').replace(/\bvap(e|es|ing)\b/gi, x => /es$/i.test(x) ? 'e-cigarettes' : 'e-cigarette');
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[ʻ'’`]/g, '').toLowerCase().trim();
const cm = () => S.committeeMembers || [];
export const cname = c => plain(S.committees?.[c]?.name || c);   // a committee in words, never its code
export const cfull = c => { const k = S.committees?.[c]; return k ? (k.chamber === 'H' ? 'House ' : 'Senate ') + plain(k.name) : c; };
const ROLE_RANK = { chair: 0, vice_chair: 1 };

// ---------------------------------------------------------------------------------- people
export const allLegs = () => (S.legislators || []).filter(l => l.active !== false).slice().sort((a, b) => String(a.sort_name).localeCompare(String(b.sort_name), 'en'));
export const legOf = id => (S.legislators || []).find(l => String(l.id) === String(id)) || null;
export const surnameOf = l => String(l.sort_name || l.name).split(',')[0].trim();
export const chamberWord = l => l.chamber === 'S' ? 'Senator' : 'Representative';
export const partyWord = l => ({ D: 'Democrat', R: 'Republican' }[l.party] || l.party || '');
export const towns = l => plain(l.places || '');
export const metaLine = l => [chamberWord(l), partyWord(l), `District ${l.district}`, towns(l)].filter(Boolean).join(' · ');
export const phoneHref = l => 'tel:' + String(l.phone || '').replace(/[^\d+,-]/g, '');
// their seats, chair first, then vice chair, then the rest by committee name
export const seatsOf = id => cm().filter(x => String(x.legislator_id) === String(id))
  .sort((a, b) => (ROLE_RANK[a.role] ?? 2) - (ROLE_RANK[b.role] ?? 2) || cname(a.committee).localeCompare(cname(b.committee), 'en'));
export const seatText = (s, withChamber = false) => ({ chair: 'Chair, ', vice_chair: 'Vice chair, ' }[s.role] || 'Member, ') + (withChamber ? cfull(s.committee) : cname(s.committee));
// the one line a list row shows beside "District 34": their first seat, chamber said ("Chair, House Health")
export const roleLine = l => { const s = seatsOf(l.id)[0]; return s ? seatText(s, true) : ''; };
export const holds = id => seatsOf(id).filter(s => s.role !== 'member');

// ---------------------------------------------------------------------------------- the viewer's people
// PRACTICE ONLY. Live, "Yours" = legislators whose contact person (legislator_team_info, migration 206, not applied) is the viewer. The practice copy has no such rows, so it
// seeds a fixed, believable set in memory: the chairs of the committees that hold the most of the viewer's own bills, at most 6. Nothing is saved or sent.
const practiceMemo = new Map();
export function yoursIds(me) {
  const real = S.legTeamInfo && Object.entries(S.legTeamInfo).filter(([, v]) => v?.owner_advocate_id === me?.id).map(([k]) => +k);
  if (real && real.length) return new Set(real);
  const key = `${me?.id}|${S.bills.length}`;
  if (!practiceMemo.has(key)) {
    const mine = aliveBills().filter(b => isYours(b, me));
    const n = new Map();
    for (const l of allLegs()) {
      const chairs = cm().filter(x => String(x.legislator_id) === String(l.id) && x.role === 'chair').map(x => x.committee);
      const c = mine.filter(b => curCodes(b).some(k => chairs.includes(k))).length;
      if (c) n.set(l.id, c);
    }
    practiceMemo.clear();
    practiceMemo.set(key, new Set([...n].sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, 6).map(x => x[0])));
  }
  return practiceMemo.get(key);
}
// who is "our contact" for a legislator: the viewer when the legislator is in their Yours set (practice); live this reads legislator_team_info
export const contactName = (l, me) => (S.legTeamInfo?.[l.id]?.owner_advocate_id ? advName(S.legTeamInfo[l.id].owner_advocate_id) : yoursIds(me).has(l.id) ? firstName(me?.full_name) : '');
const firstName = n => String(n || '').split(' ')[0];
export const advName = id => (S.advocates || []).find(a => a.id === id)?.full_name || 'A teammate';

// ---------------------------------------------------------------------------------- our bills with a legislator
export const aliveBills = () => (S.bills || []).filter(b => !m.diedish(b));
const curCodes = b => bw.codesOf(m.stopOf(b)?.committee || '');
export const isYours = (b, me) => bw.leadIds(b).includes(me?.id);
export const leadName = b => { const id = bw.leadIds(b)[0]; return id ? advName(id) : 'No lead'; };
// Groups, most telling first (one bill is in the FIRST that fits): the bill is now in a committee they CHAIR; one they are VICE chair of; they INTRODUCED it (sponsor surname, as bill.js
// matches it); it is in a committee they SIT on. A bill can be none of these, and then it is not "with" them.
export function ourBills(l, me, bills = aliveBills()) {
  const seats = seatsOf(l.id), last = surnameOf(l).toUpperCase(), G = { chair: [], vice: [], intro: [], sit: [] };
  for (const b of bills) {
    const cc = curCodes(b), here = seats.filter(s => cc.includes(s.committee));
    const seat = here.find(s => s.role === 'chair') || here.find(s => s.role === 'vice_chair') || here[0];
    const intro = (b.sponsors || []).some(s => String(s.n).toUpperCase() === last);
    if (seat?.role === 'chair') G.chair.push(b); else if (seat?.role === 'vice_chair') G.vice.push(b); else if (intro) G.intro.push(b); else if (seat) G.sit.push(b);
  }
  const all = [...G.chair, ...G.vice, ...G.intro, ...G.sit];
  return { ...G, all, yours: all.filter(b => isYours(b, me)).length, team: all.length };
}
export const GROUP_NAMES = { chair: 'Chairs the committee', vice: 'Vice chair', intro: 'Introduced', sit: 'In a committee they sit on' };
// where a bill stands, one line (place.js is the one source), committee codes turned into names
export function whereWords(b, noDeadline = false) {
  const p = pl.placeOf(b), nm = p.cmte.text.replace(/\s*\([A-Z/ ]+\)/g, '').replace(/(House|Senate) ([A-Z]{3}(?:\/[A-Z]{3})*)/, (_, ch, cs) => ch + ' ' + cs.split('/').map(cname).join(' with '));
  let t = p.line1 + (nm ? ' · ' + nm : ''); const sp = m.stopOf(b);
  if (!noDeadline && sp?.phase === 'committee' && sp.deadline?.date && !sp.deadline.missed) t += ` · deadline ${dateWords(String(sp.deadline.date).slice(0, 10))}`;
  return plain(t);
}
export const billLabel = b => ({ no: billNo(b), name: eCig(b.nickname || billName(b)), href: `#/bill/${encodeURIComponent(b.bill_number)}` });

// ---------------------------------------------------------------------------------- notes, asks, testimony, stances
export const notesOf = l => m.legNotesAll().filter(n => String(n.legislator_id) === String(l.id)).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
export const latestTalk = l => notesOf(l).find(n => !m.isAskNote(n)) || null;
// asks for a hearing, one per bill, the first note and the last answer ("asked" and "left_message" are still waiting)
export function asksOf(l) {
  const by = new Map();
  for (const n of notesOf(l).filter(x => m.isAskNote(x) && x.bill_id)) { if (!by.has(n.bill_id)) by.set(n.bill_id, []); by.get(n.bill_id).push(n); }
  return [...by.values()].map(r => { r.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)); return { b: S.bills.find(x => x.id === r[0].bill_id), first: r[0], last: r.at(-1), waiting: ['asked', 'left_message'].includes(r.at(-1).answer) }; }).filter(a => a.b)
    .sort((a, b) => new Date(b.first.created_at) - new Date(a.first.created_at));
}
export const answerWords = a => ({ asked: 'No answer yet', left_message: 'Left a message' }[a] || (a ? a.charAt(0).toUpperCase() + a.slice(1).replace(/_/g, ' ') : 'No answer yet'));
// testimony we filed to a committee they SIT on, newest first
export function testimonyOf(l) {
  const codes = seatsOf(l.id).map(s => s.committee), out = [];
  for (const [bid, arr] of Object.entries(S.drafts || {})) for (const d of arr) if (d.status === 'filed' && d.filed_at && bw.codesOf(d.committee).some(c => codes.includes(c))) { const b = S.bills.find(x => x.id === bid); if (b) out.push({ b, d }); }
  return out.sort((a, b) => new Date(b.d.filed_at) - new Date(a.d.filed_at));
}
// Stances are saved as the staff6 words (legislator_stances.stance): yes, leaning_yes, unknown, leaning_no, no. DB.setStance writes them (in memory on the practice copy).
export const STANCE_OPTS = [['yes', 'Yes'], ['leaning_yes', 'Leaning yes'], ['unknown', 'Not known'], ['leaning_no', 'Leaning no'], ['no', 'No']];
export const STANCES = STANCE_OPTS.map(x => x[1]);
export const stanceValue = (l, b) => (S.stances || []).find(s => String(s.legislator_id) === String(l.id) && s.bill_id === b.id)?.stance || 'unknown';
export const stanceOf = (l, b) => STANCE_OPTS.find(x => x[0] === stanceValue(l, b))?.[1] || 'Not known';

// "Now with them": follow-ups due (a note's follow_up_on, when the column exists), asks with no answer, and bills we support that sit in a committee they chair, need a hearing within
// 14 days and have no ask yet. view 'yours' keeps only the viewer's bills and asks; 'team' keeps all, each marked with who leads it. opts.now (YYYY-MM-DD) is for tests.
export function nowItems(l, view, me, opts = {}) {
  const now = opts.now || new Date().toLocaleDateString('en-CA', { timeZone: 'Pacific/Honolulu' }), ob = ourBills(l, me), asks = asksOf(l);
  const inView = b => view === 'team' || isYours(b, me), out = [];
  for (const n of notesOf(l)) if (n.follow_up_on && n.follow_up_on >= now.slice(0, 10) && (view === 'team' || n.advocate_id === me?.id)) out.push({ kind: 'followup', who: advName(n.advocate_id), on: String(n.follow_up_on).slice(0, 10), note: n, b: S.bills.find(x => x.id === n.bill_id) || null });
  for (const a of asks) if (a.waiting && (view === 'team' || a.first.advocate_id === me?.id || isYours(a.b, me))) out.push({ kind: 'ask', who: advName(a.first.advocate_id), b: a.b, ask: a });
  for (const b of ob.chair) {
    const sp = m.stopOf(b), d = sp?.deadline?.date && String(sp.deadline.date).slice(0, 10);
    if (inView(b) && ['support', 'strongly_support', 'support_amend'].includes(b.position) && sp?.phase === 'committee' && d && !sp.deadline.missed && !m.hearingAhead(b) && d >= now && (new Date(d) - new Date(now)) / 864e5 <= 14 && !asks.some(a => a.b.id === b.id))
      out.push({ kind: 'need', who: leadName(b), b, by: d, askKey: askKey(b, curCodes(b)[0] || '') });
  }
  return out;
}

// ---------------------------------------------------------------------------------- finding (the box on the left and the Directory read the same words)
// Matches name, district number, town, committee (name or code) and "chair". Each legislator is in ONE group, the first reason that fits, so the list can say why they matched.
export function findLegs(q0) {
  let q = norm(q0).replace(/^district\s*/, '');
  if (!q) return { q: '', groups: [], ids: null, total: 0 };
  const seen = new Set(), groups = [], isNum = /^\d+$/.test(q), wantChair = /^(chair|chairs|vice|vice chair)$/.test(q);
  const add = (key, title, l, note) => { if (seen.has(l.id)) return; seen.add(l.id); let g = groups.find(x => x.key === key); if (!g) groups.push(g = { key, title, items: [] }); g.items.push({ l, note }); };
  const legs = allLegs();
  if (!isNum) for (const l of legs) if (norm(l.name).includes(q) || norm(l.sort_name).includes(q)) add('name', 'Name', l, '');
  if (isNum) for (const l of legs) if (String(l.district) === q) add('district', `District ${q}`, l, '');
  if (wantChair) for (const l of legs) { const h = holds(l.id).filter(s => q === 'vice' || q === 'vice chair' ? s.role === 'vice_chair' : s.role === 'chair' || s.role === 'vice_chair'); if (h.length) add('chair', 'Chairs and vice chairs', l, h.map(s => seatText(s, true)).join(' · ')); }
  if (!isNum && !wantChair) {
    for (const l of legs) if (norm(l.places).includes(q)) add('town', 'Towns and areas', l, towns(l));
    for (const l of legs) { const hit = seatsOf(l.id).filter(s => norm(cname(s.committee)).includes(q) || norm(s.committee) === q); if (hit.length) add('cmte', 'On a committee that matches', l, hit.map(s => seatText(s, true)).join(' · ')); }
  }
  return { q, groups, ids: new Set(groups.flatMap(g => g.items.map(i => i.l.id))), total: seen.size };
}

// ---------------------------------------------------------------------------------- the left list: Yours, House, Senate (Yours is not repeated), or by committee
// mode 'name': [Yours, House, Senate]; mode 'committee': [Yours, then one group per committee, by their top seat]. ids narrows to a find (null = everyone).
export function listGroups(me, mode, ids = null) {
  const yours = yoursIds(me), legs = allLegs().filter(l => !ids || ids.has(l.id)), g = [];
  g.push({ key: 'yours', title: 'Yours', items: legs.filter(l => yours.has(l.id)) });
  const rest = legs.filter(l => !yours.has(l.id));
  if (mode === 'committee') {
    const by = new Map(), none = [];
    for (const l of rest) { const s = seatsOf(l.id)[0]; if (!s) { none.push(l); continue; } const k = s.committee; if (!by.has(k)) by.set(k, []); by.get(k).push(l); }
    [...by].sort((a, b) => (S.committees?.[a[0]]?.chamber === 'S' ? 0 : 1) - (S.committees?.[b[0]]?.chamber === 'S' ? 0 : 1) || cname(a[0]).localeCompare(cname(b[0]), 'en')).forEach(([k, items]) => g.push({ key: 'c-' + k, title: cfull(k), items }));
    if (none.length) g.push({ key: 'c-none', title: 'No committee', items: none });
  } else { g.push({ key: 'house', title: 'House', items: rest.filter(l => l.chamber === 'H') }); g.push({ key: 'senate', title: 'Senate', items: rest.filter(l => l.chamber === 'S') }); }
  return g;
}

// ---------------------------------------------------------------------------------- the Directory's sections
// view 'chamber': Senate then House, each in district order; 'committee': each committee (Senate first) with chair, vice chair, members; 'az': letters by surname.
// Each section: { key, title, count, rows: [{ l, seats }] }. seats is the text the Seats column shows for that row in that section.
export function directorySections(view, ids = null) {
  const legs = allLegs().filter(l => !ids || ids.has(l.id)), seatCol = l => holds(l.id).map(s => seatText(s)).join(' · ');
  if (view === 'committee') {
    const out = [];
    for (const [code, k] of Object.entries(S.committees || {}).sort((a, b) => (a[1].chamber === 'S' ? 0 : 1) - (b[1].chamber === 'S' ? 0 : 1) || cname(a[0]).localeCompare(cname(b[0]), 'en'))) {
      const rows = cm().filter(x => x.committee === code).map(x => ({ role: x.role, l: legs.find(l => l.id === x.legislator_id) })).filter(x => x.l)
        .sort((a, b) => (ROLE_RANK[a.role] ?? 2) - (ROLE_RANK[b.role] ?? 2) || String(a.l.sort_name).localeCompare(String(b.l.sort_name), 'en')).map(x => ({ l: x.l, seats: { chair: 'Chair', vice_chair: 'Vice chair' }[x.role] || 'Member' }));
      if (rows.length) out.push({ key: 'c-' + code, title: cfull(code), count: rows.length, rows });
    }
    return out;
  }
  if (view === 'az') {
    const by = new Map();
    for (const l of legs) { const ch = norm(surnameOf(l)).charAt(0).toUpperCase() || '#'; if (!by.has(ch)) by.set(ch, []); by.get(ch).push({ l, seats: seatCol(l) }); }
    return [...by].sort((a, b) => a[0].localeCompare(b[0])).map(([ch, rows]) => ({ key: 'az-' + ch, title: ch, count: rows.length, rows }));
  }
  const dist = (a, b) => a.district - b.district;
  return ['S', 'H'].map(c => { const rows = legs.filter(l => l.chamber === c).sort(dist).map(l => ({ l, seats: seatCol(l) })); return { key: 'ch-' + c, title: c === 'S' ? 'Senate' : 'House', count: rows.length, rows }; }).filter(s => s.count);
}
