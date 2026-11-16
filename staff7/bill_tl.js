// The bill page's timeline (R-398): where the bill is on its road, stop by stop, in groups: Introduced | the chamber it started in | the other chamber | Final votes and Governor.
// Each committee is its short code (a link to the committee's page) with its short name under it; each chamber ends with its floor vote. Marks are the list's own: passed = a filled dot and a dark line,
// now = a large dot and bold, to come = a ring, did not advance = a grey dot with a bar. Everything is worked out from data already in memory (the Capitol's stage and referrals, the hearings and
// outcomes the app holds, and the history once it has landed); nothing here asks for anything or writes. Under 560px of width the page shows the list's compact drawing instead (path.js).
// cmteMarks is also what the status lines use to find the committees that remain.
import { S, effStage, billStop } from '../staff6/data.js';
import { stopOf } from '../staff6/model.js';
import { esc } from './parts.js';
import { isAlive } from './standing.js';
import { PATH_NAMES } from './words.js';
import { billPath, pathOf } from './path.js';
import { codesOf, monD, RETIRED } from './bill_words.js';
import { known } from './bill_data.js';
import { floorVotes } from './bill_floor.js';

const enc = encodeURIComponent;
const num = b => String(b.bill_number).replace(/\s/g, '');
const own = b => /^S/i.test(num(b)) ? 'Senate' : 'House';
const oneChamber = b => /^[HS]R\d/.test(num(b));

// The committee a stopped bill was waiting in, when the data names it: the same reading staff6's whyWords uses (stops.js stoppedAt: the committee of the stage it died at, not bills.committee, which is the
// last committee of the referral). { leg, committee } or null when it did not stop in a committee.
function stoppedIn(b) {
  const d = b.died_at_stage || ''; if (!/^(first|second)_(triple|lateral|decking)$/.test(d)) return null;
  try { const st = billStop({ ...b, stage: d }, { deadlineFor: () => null, stage: d, hearings: [], outcomes: {} }); return st.phase === 'committee' && st.committee ? { leg: st.leg, committee: st.committee } : null; } catch { return null; }
}
// The committees in the order the bill goes through them: the ones it has passed, the one it is in, the one after. The referral list is read the way stops.js reads it: the first chamber's committees first,
// then the second's. originN: how many are the first chamber's. lo, hi: the range of the chamber the bill is in (alive bills).
export function cmteMarks(b) {
  const refs = (Array.isArray(b.referrals) ? b.referrals : []).map(String), marks = refs.map(() => ''), stage = effStage(b);
  const originN = Math.min(b.origin_stops || 0, refs.length) || (/^second_(triple|lateral|decking)$|^first_crossover$/.test(stage) ? 0 : refs.length);
  const out = { refs, marks, originN, lo: 0, hi: refs.length };
  if (!refs.length) return out;
  if (!isAlive(b)) {   // stopped: what it passed before the stop, when the stop's place on the path says so (after the first chamber's committees, all of those; at the Governor, all); else no marks, since the data does not say which committee held it
    const sa = stoppedIn(b);
    if (sa) {   // it stopped in a committee the data names: the ones before it passed (all of the first chamber's, when it stopped in the second), that one is where it stopped
      const second = sa.leg === 'second', lo = second ? originN : 0, hi = second ? refs.length : (originN || refs.length), cur = codesOf(sa.committee), at = [];
      for (let i = lo; i < hi; i++) if (codesOf(refs[i]).some(c => cur.includes(c))) at.push(i);
      if (at.length) { for (let i = 0; i < at[0]; i++) marks[i] = 'done'; for (const i of at) marks[i] = 'now'; out.lo = lo; out.hi = hi; return out; }
    }
    const i = pathOf(b).i, firstN = originN || refs.length;
    for (let k = 0; k < (i >= 4 ? refs.length : i >= 2 ? firstN : 0); k++) marks[k] = 'done';
    return out;
  }
  const st = stopOf(b), second = st.leg === 'second', lo = second ? originN : 0, hi = second ? refs.length : (originN || refs.length);
  out.lo = lo; out.hi = hi;
  if (st.phase === 'committee' && st.committee) {
    const cur = codesOf(st.committee), at = []; for (let i = lo; i < hi; i++) if (codesOf(refs[i]).some(c => cur.includes(c))) at.push(i);
    if (at.length) {
      for (let i = 0; i < at[0]; i++) marks[i] = 'done';
      for (const i of at) marks[i] = 'now';
      if (at[at.length - 1] + 1 < hi) marks[at[at.length - 1] + 1] = 'next';
    } else if (second) for (let i = 0; i < originN; i++) marks[i] = 'done';
  } else if (stage === 'first_crossover' && !st.committee) for (let i = 0; i < (originN || refs.length); i++) marks[i] = 'done';   // crossed, not yet in a committee of the other chamber: the first chamber's are all behind it
  else if (['floor', 'conference', 'governor', 'law', 'ballot'].includes(st.phase)) for (let i = 0; i < (st.phase === 'floor' && !second ? (originN || refs.length) : refs.length); i++) marks[i] = 'done';
  return out;
}

// A committee's short name without its chamber ("Transportation"), from the data layer's own list; '' for a code it has no name for
const shortName = c => String(S.committees?.[c]?.name || RETIRED[c]?.name || '').trim();
const codeLink = c => S.committees?.[c] ? `<a class="lk" href="#/search/committee/${enc(c)}">${esc(c)}</a>` : esc(c);

// When a committee passed the bill, from the hearings and outcomes in memory: "passed Feb 17", '' when they do not say
function passedOn(b, codes, kn) {
  let best = '';
  for (const h of kn.hearings) {
    if (h.status !== 'scheduled' || !codesOf(h.committee).some(c => codes.includes(c))) continue;
    const o = kn.outcomes[h.id]; if (!o || !/^passed/.test(o.outcome || '')) continue;
    const t = o.reported_at || h.scheduled_at; if (!best || String(t) > String(best)) best = t;
  }
  return best ? `passed ${monD(best)}` : '';
}

// The stops, in groups: [{ cap, w (its width in shares), stops: [{ k, codes, t, said, name, sub, s: 'done' | 'now' | 'todo' | 'x' }] }]. Also the flat list for the sentence.
export function timelineModel(b) {
  const { refs, marks, originN } = cmteMarks(b), p = pathOf(b), st = stopOf(b), alive = isAlive(b), one = oneChamber(b), kn = known(b), floors = floorVotes(kn.tl);
  const A = own(b), B = A === 'Senate' ? 'House' : 'Senate';
  const floorOn = ch => { const f = floors.find(x => x.chamber === ch); return f ? `passed ${monD(f.t)}` : ''; };
  // one chamber's part: its committees one by one when every one can be placed, else the one general stop. i: the chamber's place on the path (1 first, 3 second).
  const chamber = (lo, hi, i, ch, general) => {
    const out = [], ms = marks.slice(lo, hi);
    const placed = hi > lo && (alive ? (p.i < i || ms.includes('now') || ms.every(m => m === 'done')) : (ms.includes('now') || ms.every(m => m === 'done'))) && !(i === 3 && p.i === 2);   // crossed and not yet referred is one stop, "Not referred yet"
    if (!placed) {
      const waiting = (i === 3 && p.i === 2 && alive) || (i === 1 && p.i === 0 && !refs.length);
      const here = p.i === i, label = waiting ? 'Not referred yet' : here ? p.label : general;
      out.push({ k: 'general', t: label, said: label, s: p.i > i ? 'done' : here || (waiting && i === 3) ? 'now' : 'todo', name: '', sub: '' });
      return out;
    }
    for (let k = lo; k < hi; k++) {
      const codes = codesOf(refs[k]), s = marks[k] === 'done' ? 'done' : marks[k] === 'now' ? 'now' : 'todo';
      out.push({ k: 'cmte', codes, t: codes.join(' / '), said: codes.map(c => shortName(c) || c).join(' with '), name: codes.map(shortName).filter(Boolean).join(', '), sub: s === 'done' ? passedOn(b, codes, kn) : '', s });
    }
    const floor = i === 1 ? (p.i > 1 ? 'done' : alive && p.i === 1 && st.phase === 'floor' ? 'now' : 'todo')
      : (p.i > 3 || (p.i === 3 && alive && st.phase === 'conference') ? 'done' : alive && p.i === 3 && st.phase === 'floor' ? 'now' : 'todo');
    out.push({ k: 'floor', t: 'Floor vote', said: `${ch} floor vote`, name: '', sub: floor === 'done' ? floorOn(ch) : '', s: floor });
    return out;
  };
  const groups = [{ cap: '', w: 2, stops: [{ k: 'intro', t: 'Introduced', said: 'Introduced', name: '', sub: '', s: p.i > 0 ? 'done' : 'now' }] }];
  groups.push({ cap: A, w: 0, stops: chamber(0, originN, 1, A, PATH_NAMES[1]) });
  if (!one) groups.push({ cap: B, w: 0, stops: chamber(originN, refs.length, 3, B, PATH_NAMES[3]) });
  const fin = [];
  if (!one) fin.push({ k: 'final', t: 'Final votes', said: 'Final votes', name: 'House and Senate agree', sub: '', s: p.i > 3 ? 'done' : alive && p.i === 3 && st.phase === 'conference' ? 'now' : 'todo' });
  fin.push({ k: 'gov', t: p.i === 4 ? p.label : PATH_NAMES[4], said: p.i === 4 ? p.label : PATH_NAMES[4], name: '', sub: '', s: p.i === 4 ? 'now' : 'todo' });
  groups.push({ cap: '', w: 1.3 * fin.length, stops: fin });
  for (const g of groups) if (!g.w) g.w = g.stops.length;
  let flat = groups.flatMap(g => g.stops);
  if (!alive) {   // stopped: it ends at the first stop it did not pass, marked with the bar; nothing after it is drawn
    const at = flat.findIndex(x => x.s !== 'done'); if (at >= 0) { flat[at].s = 'x'; const keep = new Set(flat.slice(0, at + 1)); for (const g of groups) g.stops = g.stops.filter(x => keep.has(x)); }
  } else if (!flat.some(x => x.s === 'now')) { const x = flat.find(y => y.s === 'todo'); if (x) x.s = 'now'; }
  return { groups: groups.filter(g => g.stops.length), flat: groups.flatMap(g => g.stops), dead: !alive };
}

// how much of the width a stop takes, in shares: a committee needs room for its name, a joint pair more, a floor vote less
// the room a stop needs so that no word of it is cut: its longest word, in the unit of a figure's width (the codes and labels are larger and bold, so they count more)
const WORDS = t => String(t || '').split(/\s+/).filter(Boolean);
const MW = x => Math.ceil(Math.max(1, ...WORDS(x.name).map(w => w.length), ...WORDS(x.k === 'cmte' ? x.codes.join(' / ') : x.t).map(w => w.length * 1.25), ...WORDS(x.sub).map(w => w.length)));
const WT = x => x.k === 'cmte' ? (x.codes.length > 1 ? 2.2 : 1.6) : x.k === 'general' ? 1.8 : x.k === 'intro' ? 2 : x.k === 'final' ? 1.5 : x.k === 'gov' ? 2 : 1.1;
const STATE = { done: ', passed', now: ', now', todo: ', to come', x: ', where it stopped' };
function stopHTML(x) {
  const t = x.k === 'cmte' ? x.codes.map(codeLink).join(' / ') : esc(x.t);
  const sub = x.s === 'now' ? 'now' : x.s === 'x' ? 'stopped' : x.sub;
  return `<li class="bts bs-${x.s}" data-k="${x.k}" data-s="${x.s}" style="--w:${WT(x)};--mw:${MW(x)}"><b class="btk">${t}</b>${x.name ? `<small class="btnm">${esc(x.name)}</small>` : ''}${sub ? `<small class="btsb">${esc(sub)}</small>` : ''}</li>`;
}
// the compact drawing (phones) and the timeline (wider), with one sentence for a screen reader
export function billTimeline(b) {
  const m = timelineModel(b);
  const said = m.flat.map(x => `${x.said}${STATE[x.s]}`).join('. ');
  return billPath(b) + `<div class="btl${m.dead ? ' dead' : ''}">${m.groups.map(g => `<div class="btg" data-g="${esc(g.cap || '')}" style="--n:${g.stops.reduce((a, x) => a + WT(x), 0)};--gm:${g.stops.reduce((a, x) => a + MW(x), 0)};--gc:${g.stops.length}"><span class="btc">${esc(g.cap)}</span><ol class="bts-l">${g.stops.map(stopHTML).join('')}</ol></div>`).join('')}</div><span class="sr">${esc(said)}.</span>`;
}
