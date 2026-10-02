// ============================================================
// Where a bill stands — one model for both apps.
//
// A bill walks the same three steps in each chamber: it needs a committee
// hearing, the hearing is scheduled (or held and awaiting the report), and
// then it is through that chamber's committees and waits for a floor vote.
// After crossover it starts again in the other chamber. The sync's stage
// names the leg (introduced … first_crossover … second_crossover …) but
// not the step, so "first_crossover" covers both "waiting for the Senate
// vote" and "referred to a Senate committee and needs a hearing". This
// module reads the referral sequence and the current committee to tell
// those apart, and names the deadline the bill is racing.
//
// billStop(bill, ctx) -> {
//   phase:     'committee' | 'floor' | 'conference' | 'governor' | 'law' | 'dead' | 'vetoed'
//   leg:       'first' | 'second' | 'final'        which chamber run it is on
//   chamber:   'H' | 'S'                            the chamber it is in now
//   committee: 'HLT' | null                         current committee (committee phase)
//   stop, stops: 2, 3                               position in this chamber's referral sequence
//   isFinal:   true when the current committee is the last one in this chamber
//   deadlineKey, deadline: { label, date, days, missed } | null
//   hearing, hearingState: 'scheduled' | 'held' | 'decided' | 'none' (decided: the committee's report is in but the bill
//   has not moved on yet, the sync's lag or the sandbox's day picker; decided: the outcome. R-115, R-120)
//   column:    'a' | 'b' | 'c' | null               board column, null = off the board
//   says:      one plain sentence
// }
// ctx: { stage, hearings, outcomes, deadlineFor(key) -> {label, date} | null, now }
// ============================================================
export const CHAMBER_NAME = { H: 'House', S: 'Senate' };
const other = ch => (ch === 'H' ? 'S' : 'H');
const FIRST_COMMITTEE = ['introduced', 'first_triple', 'first_lateral', 'first_decking'];
const SECOND_COMMITTEE = ['second_triple', 'second_lateral', 'second_decking'];
// R-072 (backend docs/STAGE-AUDIT-2026.md): first_floor / second_floor = through that chamber's committees, waiting for
// its floor vote; second_crossover = passed the second chamber with changes, back in the first to agree or disagree;
// ballot = a constitutional amendment the Legislature passed, which goes to the voters. A resolution (HR, SR, HCR, SCR)
// ends 'enacted' when adopted, and a House or Senate resolution never leaves its chamber.
export const isResolution = b => /^(HCR|SCR|HR|SR)\d/.test(b?.bill_number || '');
export const isOneChamber = b => /^(HR|SR)\d/.test(b?.bill_number || '');
// Put on hold for the year: a committee deferring the measure with no date, or a failed vote. "Deferred the measure until
// 04-08-26" only moves the decision to that day; both apps called those bills stopped (509 bills in 2026, R-072).
export const HELD_RE = /deferred the measure(?!\s+until)|measure be deferred(?!\s+until)|failed to pass/i;

const dayOf = iso => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Pacific/Honolulu' });
const fmtShort = iso => new Date(iso).toLocaleString('en-US', { timeZone: 'Pacific/Honolulu', weekday: 'short', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const fmtDay = d => new Date(d + 'T12:00:00-10:00').toLocaleDateString('en-US', { timeZone: 'Pacific/Honolulu', month: 'numeric', day: 'numeric' });

export function billStop(b, ctx) {
  const now = ctx.now ?? Date.now();
  const stage = ctx.stage ?? b.stage ?? 'introduced';
  const refs = Array.isArray(b.referrals) ? b.referrals : [];
  const originN = Math.min(b.origin_stops || 0, refs.length) || (SECOND_COMMITTEE.includes(stage) || stage === 'first_crossover' ? 0 : refs.length);
  const firstRefs = refs.slice(0, originN || refs.length);
  const secondRefs = refs.slice(originN || refs.length);
  const origin = b.chamber || (String(b.bill_number || '').startsWith('S') ? 'S' : 'H');
  const out = { phase: 'committee', leg: 'first', chamber: origin, committee: null, stop: 0, stops: 0, isFinal: false,
    deadlineKey: null, deadline: null, hearing: null, hearingState: 'none', column: null, says: '' };

  // ---- terminal states ----
  if (stage === 'enacted') return { ...out, phase: 'law', column: null, says: isResolution(b) ? 'Adopted.' : 'Signed into law.' };
  if (stage === 'vetoed') return { ...out, phase: 'vetoed', column: null, says: 'Vetoed by the Governor.' };
  if (stage === 'ballot') return { ...out, phase: 'ballot', leg: 'final', column: null, says: 'Passed the Legislature · the voters decide in November.' };
  if (stage === 'governor') return { ...out, phase: 'governor', leg: 'final', column: null, says: 'On the Governor’s desk.' };
  if (stage === 'dead') return { ...out, phase: 'dead', column: null, says: b.died_deadline ? `Missed the ${b.died_deadline} deadline.` : 'Did not advance.' };

  // ---- which leg? ----
  // The sync's stage says which chamber run the bill is on. first_crossover
  // means it passed its first chamber: it is either waiting for a referral in
  // the second chamber or already in one of its committees.
  let leg, list;
  if (FIRST_COMMITTEE.includes(stage)) { leg = 'first'; list = firstRefs; out.phase = 'committee'; }
  else if (SECOND_COMMITTEE.includes(stage) || stage === 'first_crossover') { leg = 'second'; list = secondRefs; out.phase = 'committee'; }
  else if (stage === 'first_floor') { leg = 'first'; list = firstRefs; out.phase = 'floor'; }
  else if (stage === 'second_floor') { leg = 'second'; list = secondRefs; out.phase = 'floor'; }
  // Back from the other chamber with changes: the two chambers hold different versions, as in conference.
  else if (stage === 'second_crossover' || stage === 'conference') { leg = 'final'; list = []; out.phase = 'conference'; }
  else { leg = 'first'; list = firstRefs; out.phase = 'committee'; }
  out.leg = leg;
  out.chamber = leg === 'first' ? origin : leg === 'second' ? other(origin) : origin;

  // ---- position in this chamber's referral sequence ----
  // bills.committee is the last committee of the referral, not the one the
  // bill is sitting in. The position starts from the stage (triple = first
  // stop, decking = last, lateral = in between), then the last official
  // action moves it: "referred to X" puts it at X, "committee on X
  // recommends PASSED" / "Reported from X" puts it past X, and a hearing
  // scheduled in a committee puts it there. Past the last committee = through
  // committee, waiting for the floor.
  const hearingsHere = (ctx.hearings || []).filter(h => h.status !== 'cancelled');
  const la = b.last_action || '';
  if (out.phase === 'committee' && list.length) {
    // Lateral = before the last stop; with three or more, past Triple filing it is the second-to-last.
    let idx = /triple/.test(stage) ? 0 : /decking/.test(stage) ? list.length - 1 : list.length <= 2 ? 0 : list.length - 2;
    if (stage === 'first_crossover') idx = 0;
    // A stop matches when any committee code is shared: the Capitol writes one joint stop both
    // ways round (JDC/WAM on the referral, WAM/JDC on the hearing) and sometimes names one of the two.
    const at = c => { const want = String(c).split('/'); return list.findIndex(x => x === c || x.split('/').some(k => want.includes(k))); };
    const mRef = /referred to (?:the committee\(s\) on )?([A-Z][A-Z\/]*(?:,\s*[A-Z][A-Z\/]*)*)/i.exec(la);
    const mRep = /committee\(s\)? on\s+([A-Z][A-Z\/]*)\s+recommend\(?s?\)? that the measure be (PASSED|DEFERRED|RECOMMITTED)/i.exec(la) || /Reported from ([A-Z][A-Z\/]*)/i.exec(la);
    if (mRef) { const i = at(mRef[1].split(/\s*,\s*/)[0].toUpperCase()); if (i >= 0) idx = i; }
    else if (mRep) { const i = at(mRep[1].toUpperCase()); if (i >= 0) idx = /DEFERRED|RECOMMITTED/i.test(mRep[2] || '') ? i : i + 1; }
    for (const h of hearingsHere) {
      const i = at(h.committee);
      if (i < 0) continue;
      const o = (ctx.outcomes || {})[h.id]?.outcome;
      if (new Date(h.scheduled_at).getTime() > now) idx = i;                                 // scheduled: the bill is there
      else if (o === 'passed' || o === 'passed_amended') idx = Math.max(idx, i + 1);         // reported out: past it
      else if (!o && i > idx && now - new Date(h.scheduled_at).getTime() < 12 * 864e5) idx = i;   // held, no report yet
    }
    // The stage says which stop the bill is at (R-072: triple = before the second-to-last, lateral = the second-to-last,
    // decking = the last), so the last action and the hearings may only choose within that. A re-referral sheet named
    // the first committee again after it had passed the bill ("Re-Referred to WLA/PSM, WAM", HB1926) and the page said
    // the bill was waiting there.
    if (/_(triple|lateral|decking)$/.test(stage) && list.length) {
      const n = list.length, lo = /decking/.test(stage) ? n - 1 : /lateral/.test(stage) ? Math.max(0, n - 2) : 0;
      const hi = /triple/.test(stage) ? Math.max(0, n - 3) : lo;
      idx = Math.min(Math.max(idx, lo), hi);
    }
    if (idx >= list.length) { out.phase = 'floor'; out.stop = list.length; out.stops = list.length; }
    else {
      out.committee = list[idx]; out.stop = idx + 1; out.stops = list.length;
      out.isFinal = idx === list.length - 1;
      const triple = list.length >= 3 && idx < list.length - 2;   // must reach its second-to-last committee by Triple filing
      out.deadlineKey = leg === 'first' ? (triple ? 'first_triple' : out.isFinal ? 'first_decking' : 'first_lateral')
                                        : (triple ? 'second_triple' : out.isFinal ? 'second_decking' : 'second_lateral');
      // The Senate's first Triple filing is a day after the House's (its own session_deadlines row since R-072).
      if (out.deadlineKey === 'first_triple' && origin === 'S' && ctx.deadlineFor('first_triple_senate')) out.deadlineKey = 'first_triple_senate';
    }
  } else if (out.phase === 'committee') {
    // No referral in this chamber yet (passed the other chamber, or a carry-over): the lateral clock is running.
    out.committee = leg === 'first' ? (b.committee || null) : null;
    out.deadlineKey = leg === 'first' ? 'first_lateral' : 'second_lateral';
  }
  if (out.phase === 'floor') { out.deadlineKey = leg === 'first' ? 'first_crossover' : 'second_crossover'; out.stops = list.length; out.stop = list.length; }
  else if (out.phase === 'conference') out.deadlineKey = /\b(FIN|WAM)\b/.test(refs.join(' ')) && ctx.deadlineFor('fiscal') ? 'fiscal' : 'final_decking';

  // ---- the deadline it is racing ----
  const d = out.deadlineKey ? ctx.deadlineFor(out.deadlineKey) : null;
  if (d) {
    const end = new Date(d.date + 'T23:59:59-10:00').getTime();
    out.deadline = { key: out.deadlineKey, label: d.label, date: d.date, days: Math.max(0, Math.floor((end - now) / 864e5)), missed: end < now };
  }

  // ---- hearing in the current committee ----
  if (out.phase === 'committee') {
    const hs = hearingsHere.filter(h => !out.committee || h.committee === out.committee || !list.length)
      .sort((x, y) => x.scheduled_at.localeCompare(y.scheduled_at));
    const up = hs.find(h => new Date(h.scheduled_at).getTime() > now);
    if (up) { out.hearing = up; out.hearingState = 'scheduled'; }
    else {
      const held = hs.filter(h => now - new Date(h.scheduled_at).getTime() < 12 * 864e5).pop();
      const reported = held && ((ctx.outcomes || {})[held.id]?.outcome || (b.last_action_date && b.last_action_date > dayOf(held.scheduled_at)));
      if (held && !reported) { out.hearing = held; out.hearingState = 'held'; }
      // Reported, but the bill still sits at this committee (the sync moves it in the same run; the sandbox's day picker adds
      // the week's decisions without moving bills): it is not waiting for a hearing any more (R-115, the testers' day picker).
      else if (held && (ctx.outcomes || {})[held.id]?.outcome) { out.hearing = held; out.hearingState = 'decided'; out.decided = (ctx.outcomes || {})[held.id].outcome; }
    }
  }

  // ---- column and sentence ----
  const ch = CHAMBER_NAME[out.chamber] || 'chamber';
  const pos = out.stops ? ` · committee ${out.stop} of ${out.stops} in the ${ch}` : '';   // not "stop": staff shorthand (G-13)
  const dl = out.deadline ? ` · ${out.deadline.label} ${fmtDay(out.deadline.date)}${out.deadline.missed ? ' (missed)' : out.deadline.days <= 14 ? ` (${out.deadline.days}d)` : ''}` : '';
  if (out.phase === 'committee') {
    if (out.hearingState === 'scheduled') { out.column = 'b'; out.says = `${out.committee || ch + ' committee'} hearing ${fmtShort(out.hearing.scheduled_at)}${pos}.`; }
    else if (out.hearingState === 'held') { out.column = 'b'; out.says = `Heard by ${out.committee} ${fmtShort(out.hearing.scheduled_at)} · waiting for the committee’s report${pos}.`; }
    else if (out.hearingState === 'decided') { out.column = 'b'; out.says = `${out.decided === 'deferred' ? 'Put on hold' : /passed/.test(out.decided) ? 'Passed' : 'Decided'} by ${out.committee} ${fmtShort(out.hearing.scheduled_at)}${/passed/.test(out.decided) ? ' · on to its next step' : ''}${pos}.`; }
    else if (out.deadline?.missed) { out.column = null; out.says = `Needed a ${out.committee || ch} hearing by ${out.deadline.label} ${fmtDay(out.deadline.date)} and did not get one.`; }
    else { out.column = 'a'; out.says = out.committee ? `Needs a hearing in ${out.committee}${pos}${dl}.`
      : out.leg === 'first' ? `Introduced · waiting for a ${ch} committee referral${dl}.` : `Passed the ${CHAMBER_NAME[other(out.chamber)]} · waiting for a ${ch} referral${dl}.`; }
  } else if (out.phase === 'floor') { out.column = 'c'; out.says = `Through ${ch} committees · waiting for a floor vote${dl}.`; }
  else if (out.phase === 'conference') { out.column = 'c'; out.says = stage === 'second_crossover'
      ? `Passed the ${CHAMBER_NAME[other(origin)]} with changes · the ${CHAMBER_NAME[origin]} decides whether to agree${dl}.`
      : `In conference · House and Senate reconciling their versions${dl}.`; }
  return out;
}

// The committee a stopped bill stopped in, from the stage it stopped at: a Lateral bill in its second-to-last (or first of
// two), a Decking bill in its last, a Triple bill before its second-to-last. Not bills.committee, which is the last committee
// the latest referral names (HB1278 stopped in WLA, the first of WLA and WAM; the staff app said "waiting in WAM" and the
// public page named a 2025 hearing in another committee; R-077). Null when it did not stop in a committee.
export function stoppedAt(b, ctx = {}) {
  const d = b.died_at_stage || '';
  if (!/^(first|second)_(triple|lateral|decking)$/.test(d)) return null;
  const st = billStop({ ...b, stage: d }, { deadlineFor: () => null, ...ctx, stage: d, hearings: [], outcomes: {} });
  return st.phase === 'committee' && st.committee ? { chamber: st.chamber, committee: st.committee } : null;
}

// Column copy, shared so the two boards read the same.
export const COLUMNS = {
  a: { icon: '📡', title: 'Needs a hearing', sub: 'in committee, nothing scheduled — each shows the date it must be heard by' },
  b: { icon: '◷', title: 'Hearing scheduled', sub: 'or held, waiting for the committee’s report' },
  c: { icon: '✅', title: 'Through committee', sub: 'waiting for a floor vote, crossover, or conference' },
};
export const BOARD_EXPLAINER = 'A bill walks left to right in each chamber: it needs a hearing, the hearing happens, then it is through committee and waits for the floor. After it crosses over, it starts again on the left in the other chamber.';

// ---- Video ----
// The Capitol streams every committee hearing on its chamber's YouTube
// channel and keeps the recording there; hearing notices link to the channel,
// never to one video. The exact video, when known, wins: a staff member's
// link (hearings.stream_url), else the one the sync matched
// (hearings.stream_auto_url). Otherwise, once the hearing has started, the link
// is a search of the chamber's channel for the committee code(s) and the date,
// which is how both chambers title their streams ("HHS Public Hearing
// 03-16-2026", "HLT-HSH Joint Public Hearing - Fri Feb 6, 2026 @ 9:00 AM HST");
// tested 9/18: the hearing's video is the first result. Before the start it is
// the Live tab, where the scheduled stream appears.
export const STREAM_CHANNELS = {
  S: { name: 'Hawaiʻi State Senate', url: 'https://www.youtube.com/channel/UCekvvdL_uyq2DUyj1GjlrOA' },
  H: { name: 'Hawaiʻi House of Representatives', url: 'https://www.youtube.com/channel/UCvoLAX1ww3e63K8qQ5of0bw' },
};
// "HHS 03-16-2026" (Senate titles) or "HLT HSH Feb 6, 2026" (House titles), in Hawaiʻi time.
function streamQuery(h, chamber) {
  const codes = String(h.committee || '').split('/').map(c => c.trim()).filter(Boolean).join(' ');
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'Pacific/Honolulu', year: 'numeric', month: chamber === 'S' ? '2-digit' : 'short', day: chamber === 'S' ? '2-digit' : 'numeric' })
    .formatToParts(new Date(h.scheduled_at)).map(x => [x.type, x.value]));
  return chamber === 'S' ? `${codes} ${p.month}-${p.day}-${p.year}` : `${codes} ${p.month} ${p.day}, ${p.year}`;
}
export function hearingStream(h, chamber, now = Date.now()) {
  const ch = STREAM_CHANNELS[chamber]; if (!h || (!ch && !h.stream_url)) return null;
  const link = h.stream_url || h.stream_auto_url || null;   // staff's link, else the one the sync matched from the channel feed
  const start = new Date(h.scheduled_at).getTime(), exact = !!link;
  const state = h.status === 'cancelled' ? 'off' : now < start - 15 * 6e4 ? 'before' : now < start + 4 * 36e5 ? 'live' : 'after';
  if (state === 'off') return null;
  const search = !exact && state !== 'before';
  return { url: exact ? link : search ? `${ch.url}/search?query=${encodeURIComponent(streamQuery(h, chamber))}` : ch.url + '/streams', exact, search, auto: !h.stream_url && !!h.stream_auto_url, state, channel: ch?.name || 'YouTube',
    // A matched link opens at the bill's own minute when the video's description gives one (sync/streams.js, R-033).
    // A search results page is not a recording (R-067 word sweep): until the video's own link is known, say "find".
    label: state === 'live' ? 'Watch live' : state === 'after' ? (exact ? (/[?&]t=\d/.test(link) ? 'Watch this bill’s part' : 'Watch the recording') : 'Find the recording on YouTube') : 'Watch on YouTube',
    hint: exact ? '' : state === 'before' ? `Streams on the ${ch.name} channel; the video appears shortly before the start time.`
      : `Searches the ${ch.name} channel for this hearing; its video is the first result.` };
}

// ---- Pathway to victory ----
// The committees a bill still has to get through, in order, with each one's
// state: passed, current, next (this chamber), or predicted (the other
// chamber's referral, from the companion bill when it has one, else the
// House <-> Senate counterpart map). counterparts: [{house_code, senate_code}].
const ENDED = ['dead', 'vetoed'];
export function pathwayStops(b, st, counterparts = [], companionRefs = null) {
  const refs = b.referrals || []; if (!refs.length) return [];
  const n = Math.min(b.origin_stops || refs.length, refs.length);
  const origin = refs.slice(0, n), second = refs.slice(n);
  const originCh = b.chamber, otherCh = originCh === 'H' ? 'S' : 'H';
  const cur = st.committee, leg = st.leg || (st.chamber === originCh ? 'first' : 'second');
  const out = [];
  const inChamber = (list, ch, isCurrentLeg) => list.forEach((c, i) => {
    let state = 'next';
    if (!isCurrentLeg) state = leg === 'second' && ch === originCh ? 'passed' : 'next';
    else if (c === cur) state = 'current';
    else state = list.indexOf(cur) > i ? 'passed' : 'next';
    // A bill that is past committee in this leg really did clear these stops. A bill that DIED did
    // not necessarily clear any of them - it may have been deferred in the first one - and this
    // record cannot tell us which. It used to say "Passed" for every committee of every dead bill,
    // so the committee that killed a bill was shown as having passed it (SB1418: WAM deferred it on
    // 2/27/25 and the pathway said WAM passed). Claiming nothing is the honest answer here; naming
    // the committee that stopped it needs the activity log, which this file does not see.
    if (ENDED.includes(st.phase)) state = 'ended';
    else if (st.phase !== 'committee' && isCurrentLeg) state = 'passed';
    // A bill in conference, at the Governor, law or on the ballot got through every committee on its way (R-072: the
    // Pathway tab marked a law's second-chamber committees "Next").
    else if (['conference', 'governor', 'law', 'ballot'].includes(st.phase)) state = 'passed';
    out.push({ chamber: ch, committee: c, state, stop: i + 1, of: list.length });
  });
  inChamber(origin, originCh, leg === 'first');
  // A dead or vetoed bill is going nowhere, so it gets no predicted stops either: the old test
  // referenced st.stage, which billStop never returns, so it was always false and dead bills were
  // shown "Likely next" committees in the other chamber.
  const done = ['governor', 'law', 'ballot', 'vetoed', 'conference'].includes(st.phase) || ENDED.includes(st.phase) || isOneChamber(b);
  if (second.length) inChamber(second, otherCh, leg === 'second');
  else if (!done) {
    // predict from the companion's referral, else map each origin committee to its counterpart
    let guess = companionRefs && companionRefs.length ? companionRefs : [];
    if (!guess.length) { for (const c of origin) for (const code of c.split('/')) { const hit = counterparts.find(x => originCh === 'H' ? x.house_code === code : x.senate_code === code); const to = hit ? (originCh === 'H' ? hit.senate_code : hit.house_code) : null; if (to && !guess.includes(to)) guess.push(to); } }
    const money = originCh === 'H' ? 'WAM' : 'FIN';
    if (guess.includes(money)) guess = [...guess.filter(x => x !== money), money];   // the money committee is always last
    guess.forEach((c, i) => out.push({ chamber: otherCh, committee: c, state: 'predicted', stop: i + 1, of: guess.length, from: companionRefs?.length ? 'companion' : 'map' }));
  }
  return out;
}
