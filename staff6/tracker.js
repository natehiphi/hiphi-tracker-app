// HIPHI Staff v6 · the stage tracker at the top of a bill's page (R-336, Nate 25 Oct: "We need the stage tracker in the new
// version so people can see where it is"; of five mockups he picked C, "the named bar", "but the flags need to be improved
// or removed"). It replaces the header's one-line "where it stands" (bill.js whereLine): its caption says those words, so
// nothing is said twice (A-14, A-25).
//
// The bar: one segment per stop the bill must get through, in the bill's own order (an SB starts in the Senate): the first
// chamber's committees by their codes ("HLT/HSH", "FIN"), that chamber's vote, the second chamber's committees and vote,
// then Conference and Governor. Only the final floor vote of each chamber is a stop (the readings before it are not
// things the team works on). Done stops are leaf green, the one it is at is the action colour with its label bold, the rest
// hairline grey (A-5 on v6: green only for done). The committee's full name is in the segment's title and in the screen
// reader's sentence; the caption names it in words.
//
// The flags (Nate's "improve or remove"; the mockup listed all seven deadlines, past ones included, in a row of their own):
// only Capitol deadlines still ahead, and only the ones this bill has not already beaten, each a flag and a date as a
// second line under the last stop the deadline needs it to be past ("WAM", then "by 4/10"). A deadline behind it is history: the bill made it. Hawaiʻi's rules
// (Public Access Room; model.js GATE_WORDS): Triple filing (3 or more committees) = all but the last two committees in that
// chamber; Lateral = all but the last; Decking = all of them; Crossover / Cross back = that chamber's vote; Final decking
// (Fiscal for a bill sent to FIN or WAM, stops.js) = conference. The next one is in bold ("by 3/30"), the others plain
// ("by 4/10"), short so each fits under its stop; the caption's second line is the one place that names it and says what it asks.
// (First drawn in the gaps between stops, where a date read as the next stop's: fresh-eyes review, 25 Oct.) Each vote is
// labelled "Vote": the chamber's heading over it says whose ("House vote" wrapped onto two lines).
//
// Phones (the tracker narrower than 600px, a container query, so a tablet with the sidebar gets it too): the slim bar with
// no labels, "Step 4 of 8 · in Senate Health and Human Services", the next deadline's line, and "See every step", which opens every stop as a list, each with
// its day when it passed and the deadlines ahead under the stop they gate.
//
// Stopped bills, vetoes, laws and resolutions follow ui.js stageRibbon's hard-won rules: a stopped bill is marked where it
// stopped (died_at_stage, not its stage, which is only 'dead'), with no stop claimed when the record does not say (2 bills
// in 2026); a resolution has no Governor and ends "Adopted"; a House or Senate resolution never leaves its chamber. A
// stopped or finished bill has no flags. Stopped is said calmly, in neutral (A-5 on v6: red only for a step still to do).
import { S, DEADLINE_ROWS, effStage, esc } from './data.js';
import { CHAMBER_NAME, pathwayStops, isResolution, isOneChamber, stoppedAt } from '../stops.js';
import { stopOf, diedish, whenAt, codesOf, cmteName, plainDeadlines, gateNeed } from './model.js';
import { committeeName, dayWords, timeWords } from './steps.js';
import { icon, btn } from './ui.js';

const OTHER = { H: 'S', S: 'H' };
const DAY = 864e5;
const endOfDay = d => new Date(d + 'T23:59:59-10:00').getTime();
const shortDate = d => { const [, m, dd] = String(d).split('-'); return `${+m}/${+dd}`; };
const cmteFull = code => committeeName(code) || cmteName(code) || code;
// The deadline's own name: "Second lateral", "Crossover", "Final decking" (model.js gateName, inlined for the keys).
const dlName = r => /^(first|second)_/.test(r.key) && /^(Lateral|Decking|Triple filing)$/.test(r.label) ? `${r.key.startsWith('first') ? 'First' : 'Second'} ${r.label.toLowerCase()}` : r.label;

// Every hearing of the bill the page knows: its own history (bill.js loads S.billHist) and the ones Staff holds.
function hearingsOf(b) {
  const by = new Map(), g = S.billHist?.[b.id];
  for (const h of [...(g && g.hearings ? g.hearings : []), ...(S.hearings || []).filter(h => h.bill_id === b.id)]) if (h.status !== 'cancelled') by.set(h.id, h);
  return [...by.values()].sort((x, y) => x.scheduled_at.localeCompare(y.scheduled_at));
}
const sameCmte = (x, y) => codesOf(x).some(c => codesOf(y).includes(c));
// The day a committee passed it: its hearing with a passed result, else (the stop is done) its last hearing held.
function passedDay(b, code) {
  const hs = hearingsOf(b).filter(h => sameCmte(h.committee, code) && new Date(h.scheduled_at).getTime() <= Date.now());
  const ok = hs.filter(h => /^passed/.test(S.outcomes?.[h.id]?.outcome || '')).pop() || hs.pop();
  return ok ? dayWords(ok.scheduled_at) : '';
}

// ---- the stops ----
// [{ kind: 'cmte'|'cmtes'|'vote'|'conf'|'gov', group: 'H'|'S'|'F', code, label, full }], plus where each chamber's run
// starts and how many committees it has (n: null when the chamber has no referral yet, one "Committees" stop stands in).
function stopsOf(b) {
  const refs = Array.isArray(b.referrals) ? b.referrals : [], res = isResolution(b), one = isOneChamber(b);
  const origin = b.chamber || (String(b.bill_number || '').startsWith('S') ? 'S' : 'H'), other = OTHER[origin];
  const n = Math.min(b.origin_stops || refs.length, refs.length);
  const lists = { [origin]: refs.slice(0, n), [other]: refs.slice(n) };
  const out = [], runs = {};
  const chamber = (ch, leg) => {
    const list = lists[ch], start = out.length;
    if (list.length) list.forEach(c => out.push({ kind: 'cmte', group: ch, code: c, label: c, full: cmteFull(c), leg }));
    else out.push({ kind: 'cmtes', group: ch, label: 'Committees', full: `${CHAMBER_NAME[ch]} committees (not sent to one yet)`, leg });
    runs[leg] = { start, n: list.length || null, vote: out.length };
    out.push({ kind: 'vote', group: ch, label: 'Vote', full: `A vote of the full ${CHAMBER_NAME[ch]}`, leg });
  };
  chamber(origin, 'first');
  if (!one) chamber(other, 'second');
  if (!res) {
    out.push({ kind: 'conf', group: 'F', label: 'Conference', full: 'Conference: House and Senate settle one version', leg: 'final' });
    // A constitutional amendment goes to the voters, not the Governor (stops.js 'ballot').
    out.push(effStage(b) === 'ballot' ? { kind: 'gov', group: 'F', label: 'Voters', full: 'The voters decide in November', leg: 'final' }
      : { kind: 'gov', group: 'F', label: 'Governor', full: 'The Governor signs it into law, or vetoes it', leg: 'final' });
  }
  return { stops: out, runs, origin, other, res };
}

// Where the bill stands: { at (index of its stop, -1 when no stop is marked), state: 'live'|'stopped'|'vetoed'|'done' }.
function placeOf(b, model) {
  const { stops, runs } = model, st = stopOf(b), stage = effStage(b);
  const idxOfCmte = (leg, code) => { const r = runs[leg]; if (!r) return -1;
    if (!r.n) return r.start;
    const i = stops.findIndex((s, k) => k >= r.start && k < r.vote && s.code === code);
    return i >= 0 ? i : -1; };
  const fromStop = (s0) => {
    if (s0.phase === 'committee') return s0.committee ? idxOfCmte(s0.leg, s0.committee) : runs[s0.leg]?.start ?? -1;
    if (s0.phase === 'floor') return runs[s0.leg]?.vote ?? -1;
    if (s0.phase === 'conference') return stops.findIndex(s => s.kind === 'conf');
    if (s0.phase === 'governor' || s0.phase === 'ballot') return stops.findIndex(s => s.kind === 'gov');
    return -1;
  };
  if (st.phase === 'law') return { at: stops.length, state: 'done', st };
  if (st.phase === 'vetoed') return { at: stops.findIndex(s => s.kind === 'gov'), state: 'vetoed', st };
  if (stage === 'dead' || st.phase === 'dead') {
    // Where it stopped: died_at_stage, else (the team set it dead) the sync's own stage. No record: no stop is marked.
    const d = b.died_at_stage || (b.stage !== 'dead' ? b.stage : null);
    if (!d) return { at: -1, state: 'stopped', st };
    const asStage = d === 'introduced' ? 'first_lateral' : d === 'first_crossover' ? 'second_lateral' : d;
    const where = stoppedAt({ ...b, died_at_stage: asStage });
    if (where) { const leg = runs.first && stops[runs.first.start]?.group === where.chamber ? 'first' : 'second';
      return { at: idxOfCmte(leg, where.committee), state: 'stopped', st }; }
    if (/_triple|_lateral|_decking/.test(asStage)) return { at: runs[asStage.startsWith('first') ? 'first' : 'second']?.start ?? -1, state: 'stopped', st };
    if (d === 'first_floor') return { at: runs.first.vote, state: 'stopped', st };
    if (d === 'second_floor') return { at: runs.second?.vote ?? -1, state: 'stopped', st };
    if (d === 'conference' || d === 'second_crossover') return { at: stops.findIndex(s => s.kind === 'conf'), state: 'stopped', st };
    if (d === 'governor') return { at: stops.findIndex(s => s.kind === 'gov'), state: 'stopped', st };
    return { at: -1, state: 'stopped', st };
  }
  // Put on hold by its committee (deferred with no date) or the session ended: stopped where it is.
  return { at: fromStop(st), state: diedish(b) ? 'stopped' : 'live', st };
}

// ---- the deadlines ahead ----
// The calendar's rows for this bill: a budget bill's own row replaces the general one (`bills`, `replaces`, 087); a row
// with a `chamber` is that chamber's (the Senate's first Triple filing is a day after the House's).
function rowsFor(b, model) {
  const rows = DEADLINE_ROWS || [], mine = rows.filter(r => !r.bills || r.bills.includes(b.bill_number));
  const replaced = new Set(mine.filter(r => r.replaces).map(r => r.replaces));
  return mine.filter(r => !replaced.has(r.key));
}
// Each deadline's place on the bar: the edge (a stop index, the left edge of that stop; fractions for a chamber with no
// referral yet, where one "Committees" stop stands in) the bill must be past by its day.
function flagsOf(b, model, place) {
  if (model.res || place.state !== 'live') return [];
  const { stops, runs, origin } = model, out = [];
  const money = /\b(FIN|WAM)\b/.test((b.referrals || []).join(' '));
  for (const r of rowsFor(b, model)) {
    const date = String(r.deadline_date).slice(0, 10), base = r.replaces || r.key;
    const m = /^(first|second)_(triple|lateral|decking|crossover)(_senate)?$/.exec(base) || (/^budget_(decking|crossover)$/.exec(base) ? [base, 'first', base.slice(7)] : null);
    let edge = null;
    if (m) {
      const leg = m[1], run = runs[leg]; if (!run) continue;
      const ch = stops[run.start].group;
      if (r.chamber && r.chamber !== ch) continue;
      const kind = m[2];
      if (kind === 'crossover') edge = run.vote + 1;
      else if (!run.n) edge = kind === 'decking' ? run.start + 1 : kind === 'lateral' ? run.start + 0.5 : null;   // triple needs 3+, unknown here
      else if (kind === 'triple') edge = run.n >= 3 ? run.start + run.n - 2 : null;
      else if (kind === 'lateral') edge = run.start + run.n - 1;
      else edge = run.start + run.n;
    } else if (base === (money && rowsFor(b, model).some(x => x.key === 'fiscal') ? 'fiscal' : 'final_decking')) {
      const c = stops.findIndex(s => s.kind === 'conf'); if (c >= 0) edge = c + 1;
    }
    if (edge == null || edge <= 0) continue;
    if (endOfDay(date) < Date.now()) continue;               // behind it: history, the bill made it
    if (place.at >= edge) continue;                          // it is already past this edge: beaten early
    out.push({ key: r.key, name: dlName({ key: base, label: r.label }), date, edge });
  }
  out.sort((x, y) => x.date.localeCompare(y.date) || x.edge - y.edge);
  // Two deadlines on one edge (a budget bill's decking and the general one never both survive, but Lateral with one
  // committee and an unreferred chamber can): the earlier speaks for the edge.
  const seen = new Set();
  return out.filter(f => !seen.has(f.edge) && seen.add(f.edge)).map((f, i) => ({ ...f, next: i === 0 }));
}
// What a deadline asks, in words: "must pass the committee it is in now and Senate Ways and Means", "must pass a vote of
// the full Senate", "must be agreed by the House and Senate".
function mustOf(f, model, place) {
  const { stops } = model, at = Math.max(place.at, 0), edge = Math.ceil(f.edge) - 1, s = stops[edge];
  if (!s) return '';
  if (s.kind === 'vote') return `must pass ${s.full.replace(/^A /, 'a ')}`;
  if (s.kind === 'conf') return 'must be agreed by the House and Senate';
  if (s.kind === 'cmtes') return `must ${gateNeed(f.name)}`;
  const names = [];
  for (let i = at; i <= edge; i++) { const x = stops[i]; if (x.kind !== 'cmte') continue; names.push(i === place.at ? 'the committee it is in now' : x.full); }
  if (!names.length) return `must ${gateNeed(f.name)}`;
  return `must pass ${names.length < 3 ? names.join(' and ') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`}`;
}

// ---- the words ----
// The caption's first line. `says` (bill.js cardSays): the step card under it names the committee and its hearing, so the
// line keeps only where it is among the chamber's committees (A-14). `heardNow`: a sitting under way with no result yet.
function nowWords(b, model, place, { says, heardNow } = {}) {
  const { st } = place, stage = effStage(b), ch = CHAMBER_NAME[st.chamber] || '';
  if (place.state === 'done') return model.res || /^(HCR|SCR|HR|SR)\d/.test(b.bill_number || '') ? 'Adopted.' : 'Signed into law.';
  if (place.state === 'vetoed') return 'Vetoed by the Governor.';
  if (place.state === 'stopped') return '';
  if (st.phase === 'committee') {
    if (!st.committee) return `Now: waiting to be sent to a ${esc(ch)} committee.`;
    const pos = st.stops > 1 ? `${ch} committee ${st.stop} of ${st.stops}` : `its only ${ch} committee`;
    if (says) return `Now: ${esc(pos)}.`;
    const name = `<b>${esc(cmteFull(st.committee))}</b>`;
    if (heardNow) return `Now: ${name}, its hearing started ${esc(timeWords(heardNow.scheduled_at))}.`;
    if (st.hearingState === 'scheduled') return `Now: ${name}, hearing ${esc(whenAt(st.hearing.scheduled_at))}.`;
    if (st.hearingState === 'held') return `Now: ${name}, heard ${esc(dayWords(st.hearing.scheduled_at))}, waiting for its vote.`;
    if (st.hearingState === 'decided') return /passed/.test(st.decided || '') ? `Now: ${name} passed it ${esc(dayWords(st.hearing.scheduled_at))}; on to its next step.` : `Now: ${name}, decided ${esc(dayWords(st.hearing.scheduled_at))}.`;
    return `Now: ${name}, waiting for a hearing.`;
  }
  if (st.phase === 'floor') return `Now: through its ${esc(ch)} committees, waiting for <b>a vote of the full ${esc(ch)}</b>.`;
  if (st.phase === 'conference') return stage === 'second_crossover'
    ? `Now: passed the ${esc(CHAMBER_NAME[OTHER[model.origin]])} with changes; the ${esc(CHAMBER_NAME[model.origin])} decides whether to agree.`
    : 'Now: <b>in conference</b>, where House and Senate negotiators settle one version.';
  if (st.phase === 'governor') return 'Now: <b>on the Governor’s desk</b>.';
  if (st.phase === 'ballot') return 'Passed the Legislature; <b>the voters decide</b> in November.';
  return esc(st.says || '');
}
// The phone's step line names the place, the step number being the one count ("Step 4 of 8 · in Senate Health and Human
// Services"; fresh-eyes review: "Step 4 of 8 · Senate committee 1 of 2" gave two counts and no place).
function placeWords(place) {
  const { st } = place, ch = CHAMBER_NAME[st.chamber] || '';
  if (place.state !== 'live') return '';
  if (st.phase === 'committee') return st.committee ? `in ${cmteFull(st.committee)}` : `waiting to be sent to a ${ch} committee`;
  if (st.phase === 'floor') return `waiting for a vote of the full ${ch}`;
  if (st.phase === 'conference') return 'in conference';
  if (st.phase === 'governor') return 'on the Governor’s desk';
  if (st.phase === 'ballot') return 'the voters decide in November';
  return '';
}
// "Stopped at House Transportation: did not reach its last committee by Fri 2/20." (`dead`: bill.js deadWords, escaped.)
function stoppedWords(model, place, dead) {
  const s = model.stops[place.at], why = String(dead || '').replace(/\s*\(it was waiting in [^)]*\)/, '');
  const at = s ? (s.kind === 'cmte' ? s.full : s.kind === 'cmtes' ? `its ${CHAMBER_NAME[s.group]} committees` : s.kind === 'vote' ? `the ${CHAMBER_NAME[s.group]} vote` : s.kind === 'conf' ? 'conference' : 'the Governor') : '';
  const w = why ? why.charAt(0).toLowerCase() + why.slice(1) : '';
  return at ? `Stopped at <b>${esc(at)}</b>${w ? `: ${w}` : ''}.` : `Stopped${w ? `: ${w}` : ''}.`;
}

export function trackerModel(b, opts = {}) {
  const model = stopsOf(b), place = placeOf(b, model), flags = flagsOf(b, model, place);
  const st = place.st, cur = place.at;
  // Each stop's state. A stopped bill is done up to where it stopped (stops.js stoppedAt: a bill that stopped at its
  // decking stop made the lateral deadline, so it got through the ones before it).
  const pw = place.state === 'live' ? pathwayStops(b, st, S.counterparts || [], null) : [];
  model.stops.forEach((s, i) => {
    s.state = i < cur ? 'done' : i === cur ? (place.state === 'live' ? 'now' : place.state === 'done' ? 'done' : 'stopped') : 'next';
    // a committee the Capitol's record marks passed out of order (pathway.js agrees with this)
    if (s.kind === 'cmte' && place.state === 'live') { const p = pw.find(x => x.committee === s.code); if (p?.state === 'passed' && s.state === 'next') s.state = 'done'; }
    if (s.state === 'done' && s.kind === 'cmte') s.day = passedDay(b, s.code);
  });
  const next = flags.find(f => f.next) || null;
  return { ...model, place, flags, next, cur, n: model.stops.length,
    now: place.state === 'stopped' ? stoppedWords(model, place, opts.dead) : nowWords(b, model, place, opts),
    must: next ? mustOf(next, model, place) : '', where: placeWords(place) };
}

const GROUP = { H: 'House', S: 'Senate', F: 'Final steps' };
// The bar's groups: [group, first index, count] in the bill's order.
const groupsOf = stops => stops.reduce((g, s, i) => { const last = g[g.length - 1]; if (last && last[0] === s.group) last[2]++; else g.push([s.group, i, 1]); return g; }, []);
const STATE_WORD = { done: 'done', now: 'now', next: 'still to come', stopped: 'stopped here' };

// The tracker's HTML. opts: { says, heardNow, dead } from bill.js (see nowWords and stoppedWords).
export function trackerHTML(b, opts = {}) {
  let m; try { m = trackerModel(b, opts); } catch (e) { console.error(e); return ''; }
  const plain = plainDeadlines();
  const { stops, flags, next, n } = m;
  const set = b.stage_override ? ' <span class="tk-set">(set by the team)</span>' : '';
  // Screen readers get one sentence for the bar, and the stop list; the drawn bar is for the eye (its titles for a mouse).
  const sr = `${m.place.state === 'live' && m.cur >= 0 ? `Step ${m.cur + 1} of ${n}. ` : ''}${stops.map(s => `${s.full}: ${STATE_WORD[s.state]}`).join('; ')}.${flags.length ? ` Deadlines ahead: ${flags.map(f => `${plain ? '' : f.name + ', '}${dayWords(f.date)}`).join('; ')}.` : ''}`;
  const col = `grid-template-columns: repeat(${n}, minmax(0, 1fr))`;
  // Each deadline ahead is a second line under the stop it gates (the last stop it needs passed), "by 4/10", the next one in
  // bold. Drawn in the gaps between stops, a date read as the next stop's (fresh-eyes review: HB 1562's 4/10,
  // WAM's decking, sat over Senate vote). The caption is the one place that names the next deadline and says what it asks;
  // when the caption leaves it to a chair ask's card, the bar's next one keeps its name. A stop gates one deadline at most
  // (the earliest: Lateral and Decking share an unreferred chamber's one "Committees" stop).
  const gate = i => flags.find(f => Math.ceil(f.edge) - 1 === i);
  const dl = f => !f ? '' : `<span class="tk-d${f.next ? ' is-next' : ''}">${icon('flag', { cls: 'tk-fi' })}<span>${esc(f.next
    && opts.cardDeadline && !plain ? `${f.name} ${shortDate(f.date)}` : `by ${shortDate(f.date)}`)}</span></span>`;
  const heads = groupsOf(stops).map(([g, i, k]) => `<span class="tk-grp" style="grid-column: ${i + 1} / span ${k}">${GROUP[g]}</span>`).join('');
  const segs = stops.map((s, i) => `<span class="tk-seg is-${s.state}" title="${esc(s.full)}${s.day ? ` · passed ${esc(s.day)}` : ''}${gate(i) ? ` · ${esc(gate(i).name)} ${esc(dayWords(gate(i).date))}` : ''}"><i class="tk-b"></i><span class="tk-l">${s.state === 'done' ? icon('check', { cls: 'tk-li-ic' }) : s.state === 'stopped' ? icon('circle-minus', { cls: 'tk-li-ic' }) : ''}${esc(s.label)}</span>${dl(gate(i))}</span>`).join('');
  // A chair ask's card says the deadline it races ("It must clear its last committee by Fri 4/10"): the flag on the bar
  // still marks it, the caption does not say it again (A-14).
  const nextLine = next && !opts.cardDeadline ? `<p class="tk-next">${icon('flag', { cls: 'tk-fi' })}<span>Next deadline <b>${esc(plain ? dayWords(next.date) : `${next.name}, ${dayWords(next.date)}`)}</b>: ${esc(m.must)}.</span></p>` : '';
  const done = m.place.state === 'done' ? icon('circle-check', { cls: 'tk-ok' }) : m.place.state !== 'live' ? icon('circle-minus', { cls: 'tk-stop' }) : '';
  const nowLine = m.now ? `<p class="tk-now">${done}<span>${m.now}${set}</span></p>` : '';
  // The phone's step line: "Step 4 of 8 · Senate committee 1 of 2" (the full words are the first caption line's, which
  // the phone leaves out but for a stopped or finished bill).
  const stepLine = m.place.state === 'live' && m.cur >= 0 ? `<p class="tk-step"><span>Step ${m.cur + 1} of ${n}</span>${m.where ? `<span class="tk-sw"> · ${esc(m.where)}</span>` : ''}${set}</p>` : nowLine;
  // Every stop as a list (the phone's "See every step"): its day when it passed, the deadlines ahead under the stop they gate.
  let g0 = '';
  const list = stops.map((s, i) => {
    const h = s.group !== g0 ? (g0 = s.group, `<li class="tk-lh" aria-hidden="true">${GROUP[s.group]}</li>`) : '';
    const word = s.state === 'done' ? `Passed${s.day ? ' ' + s.day : ''}` : s.state === 'now' ? 'Now' : s.state === 'stopped' ? 'Stopped here' : '';
    const fl = flags.filter(f => Math.ceil(f.edge) - 1 === i).map(f => `<li class="tk-lf">${icon('flag', { cls: 'tk-fi' })}<span>${esc(plain ? `Deadline ${dayWords(f.date)}` : `${f.name}, ${dayWords(f.date)}`)}</span></li>`).join('');
    return `${h}<li class="tk-li is-${s.state}"><span class="tk-dot" aria-hidden="true"></span><span class="tk-lt">${esc(s.kind === 'cmte' ? s.full : s.label)}${word ? `<span class="tk-lw"> · ${esc(word)}</span>` : ''}</span></li>${fl}`;
  }).join('');
  const open = !!S.tkOpen?.has(b.id);
  return `<section class="tk${opts.says ? ' tk-short' : ''}" aria-labelledby="tk-h" data-tk="${esc(b.id)}">
    <h2 class="sr" id="tk-h">Where it is</h2><p class="sr">${esc(sr)}</p>
    <div class="tk-in"><div class="tk-wide" aria-hidden="true">
      <div class="tk-heads" style="${col}">${heads}</div>
      <div class="tk-bar" style="${col}">${segs}</div>
    </div>
    <div class="tk-slim" aria-hidden="true" style="${col}">${stops.map(s => `<i class="is-${s.state}"></i>`).join('')}</div>
    <div class="tk-cap">${nowLine.replace('class="tk-now"', 'class="tk-now tk-onwide"')}${stepLine.replace(/class="tk-(step|now)"/, 'class="tk-$1 tk-onslim"')}${nextLine}</div>
    ${btn(open ? 'Hide the steps' : 'See every step', { kind: 'text', iconEnd: open ? 'chevron-up' : 'chevron-down', cls: 'tk-more', attrs: { 'data-tkmore': '1', 'aria-expanded': String(open), 'aria-controls': 'tk-list' } })}
    <ol class="tk-list" id="tk-list"${open ? '' : ' hidden'}>${list}</ol></div>
  </section>`;
}

// "See every step" opens and closes the list in place (remembered for the visit), with no redraw.
export function wireTracker(root, b) {
  const t = root?.querySelector('.tk'); if (!t) return;
  const b0 = t.querySelector('[data-tkmore]'), list = t.querySelector('#tk-list');
  if (b0 && list) b0.onclick = () => {
    const open = list.hidden; list.hidden = !open; b0.setAttribute('aria-expanded', String(open));
    S.tkOpen ??= new Set(); open ? S.tkOpen.add(b.id) : S.tkOpen.delete(b.id);
    b0.querySelector('span').textContent = open ? 'Hide the steps' : 'See every step';
    b0.querySelector('.ic:last-child')?.replaceWith(Object.assign(document.createElement('template'), { innerHTML: icon(open ? 'chevron-up' : 'chevron-down') }).content.firstChild);
  };
}
