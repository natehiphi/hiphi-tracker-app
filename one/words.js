// Where a bill stands, in plain words, for act.html (R-360). Ported from pub/core.js (plainStatus, stopDetail, stopFacts,
// dueInfo, dayWord, timeWord, dateLong, cmteLabel) and pub/kernel.js (alive, cleanDesc, spaced) so this page does not load
// the tracker's module-heavy kernel. The words are the same; what changed is where the facts come from: core.js reads the
// page-wide state S, these read one bill's facts W = { now, committees, hearings, outcomes, deadlines } passed in by
// one/data.js. When core.js changes one of these sentences, change it here too.
// The bill's step (which committee, which hearing, which deadline) still comes from stops.js and the committee names from
// pub/capitol.js, imported as they are: both have no imports, and both apps already agree on them.
import { billStop, stoppedAt, CHAMBER_NAME, HELD_RE, isResolution } from '../stops.js';
import { theCmteName, cmteInfo, codesOf } from '../pub/capitol.js';
import { t } from './i18n.js';

// Every time on this page is Hawaiʻi time: hearings and testimony deadlines are set by the Capitol in HST, and a reader on
// the mainland must see the Capitol's clock, not their own.
export const HST = 'Pacific/Honolulu';
const hstDay = d => new Date(d).toLocaleDateString('en-CA', { timeZone: HST });
const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

// kernel.js
export const alive = b => !['dead', 'vetoed', 'enacted', 'governor', 'ballot'].includes(b.stage || '') && !HELD_RE.test(b.last_action || '');
export const spaced = n => String(n || '').replace(/^([A-Z]+)\s*(\d)/, '$1 $2');   // "HB2121" -> "HB 2121"
// Official descriptions end with drafting notes ("Effective 7/1/3000.  (HD1)") that mean nothing to a neighbour: no version
// codes on this page (R-360).
export function cleanDesc(t) {
  let x = String(t || '').replace(/\s+/g, ' ').trim(), prev;
  do { prev = x;
    x = x.replace(/\s*\((?:[HSC]D\s?\d+[\s,]*)+\)\s*$/i, '')
      .replace(/\s*(?:Effective|Takes effect|Sunsets?)\b[^.]*?\d{4}\.?\s*$/i, '')
      .replace(/([.!?])\s*\d{1,2}\/\d{1,2}\/\d{4}\.?\s*$/, '$1').trim();
  } while (x !== prev);
  return x;
}

// core.js, the dates (with W.now for "today": the practice copy runs on 16 March 2026)
const DOW = { timeZone: HST, weekday: 'short' };
export const dayWord = (iso, W) => {   // "today", "tomorrow (Tue)", "Thu", "Mon, Mar 30"
  const d = hstDay(iso), today = hstDay(W.now), tmr = hstDay(W.now + 864e5), days = (new Date(d + 'T12:00:00-10:00') - new Date(today + 'T12:00:00-10:00')) / 864e5;
  const wd = new Date(iso).toLocaleDateString('en-US', DOW);
  return d === today ? 'today' : d === tmr ? `tomorrow (${wd})` : days > 0 && days < 7 ? wd : new Date(iso).toLocaleDateString('en-US', { timeZone: HST, weekday: 'short', month: 'short', day: 'numeric' });
};
export const timeWord = iso => new Date(iso).toLocaleTimeString('en-US', { timeZone: HST, hour: 'numeric', minute: '2-digit' });
// A date from another year says its year (R-067).
export const dateLong = (iso, W) => { const d = new Date(iso), other = hstDay(d).slice(0, 4) !== hstDay(W.now).slice(0, 4);
  return d.toLocaleDateString('en-US', { timeZone: HST, weekday: 'short', month: 'short', day: 'numeric', ...(other ? { year: 'numeric' } : {}) }); };
// The Capitol's week and one deadline wording for every screen (R-360 fix pass, C-15: one wording per state). Home, Bills,
// This week and the bill all say a testimony deadline through sendBy, so the four never disagree:
//   "Send testimony by today 9:30 AM", "by tomorrow 1:00 PM", "by Wed 9:30 AM" within six days, "by Wed, Mar 25, 9:30 AM" beyond.
// soon: within 24 hours, the only time it is amber (A-5).
const noon = day => new Date(day + 'T12:00:00-10:00').getTime();
const plusDays = (day, n) => hstDay(noon(day) + n * 864e5);
export const daysFrom = (iso, now) => Math.round((noon(hstDay(iso)) - noon(hstDay(now))) / 864e5);
// "This week" is the Capitol's week in Hawaiʻi time: Monday to Friday, from today on; at the weekend, the week ahead.
// end: the Monday after, the edge of "this week" for a deadline.
export function capitolWeek(now) {
  const today = hstDay(now), dow = new Date(noon(today)).getUTCDay();   // noon in Hawaiʻi is the same date in UTC
  const mon = dow === 6 ? plusDays(today, 2) : dow === 0 ? plusDays(today, 1) : plusDays(today, 1 - dow);
  const days = [0, 1, 2, 3, 4].map(n => plusDays(mon, n)).filter(d => d >= today), next = [7, 8, 9, 10, 11].map(n => plusDays(mon, n));
  return { today, days, next, end: plusDays(mon, 7), endIso: new Date(plusDays(mon, 7) + 'T00:00:00-10:00').toISOString() };
}
const dayShort = iso => new Date(iso).toLocaleDateString('en-US', { timeZone: HST, weekday: 'short', month: 'short', day: 'numeric' });
// "today", "tomorrow", "Wed" within six days, else "Wed, Mar 25".
export function whenWord(iso, now) {
  const d = daysFrom(iso, now);
  return d === 0 ? t('when.today') : d === 1 ? t('when.tomorrow') : d > 1 && d < 7 ? new Date(iso).toLocaleDateString('en-US', DOW) : dayShort(iso);
}
export function sendBy(iso, now) {
  const d = daysFrom(iso, now), time = timeWord(iso), left = new Date(iso).getTime() - now;
  const text = d >= 0 && d < 7 ? t('due.by', { when: whenWord(iso, now), time }) : t('due.by.date', { date: dateLong(iso, { now }), time });
  return { text, soon: left > 0 && left < 864e5 };
}
// A hearing row's line: "Hearing Fri, Mar 20, 9:30 AM" while it is ahead, "Heard ..." only once it has begun (C-10).
export const hearingWords = (iso, now) => t(new Date(iso).getTime() > now ? 'hear.ahead' : 'hear.past', { date: dayShort(iso), time: timeWord(iso) });

const shortDate = mdy => new Date(mdy.replace(/(\d+)\/(\d+)\/(\d+)/, (x, mo, d, y) => `20${y.slice(-2)}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`) + 'T12:00:00-10:00').toLocaleDateString('en-US', { timeZone: HST, month: 'short', day: 'numeric' });
const inHours = ms => { const h = Math.ceil(ms / 36e5); return h <= 1 ? 'in under an hour' : `in under ${h} hours`; };
// core.js dueInfo, without the minute timer: within a day the honest countdown leads (R-046), rounded up and said as "under".
export function dueInfo(h, W) {
  if (!h?.testimony_deadline) return null;
  const iso = h.testimony_deadline, left = new Date(iso).getTime() - W.now;
  if (left <= 0) return { text: `Testimony deadline passed ${dateLong(iso, W)} at ${timeWord(iso)}`, late: true };
  return { text: left < 864e5 ? `Testimony due ${inHours(left)}, ${dayWord(iso, W)} at ${timeWord(iso)}` : `Testimony due ${dayWord(iso, W)} at ${timeWord(iso)}`, late: false, soon: left < 864e5 };
}

// core.js, the committees: "Senate Health Committee" (cmteLabel) and "the Senate Health Committee" in a sentence (C-15).
export function cmteLabel(code, W, { short = false } = {}) {
  const cs = codesOf(code).map(c => cmteInfo(c, W.committees)).filter(Boolean);
  if (!cs.length) return code ? `the ${code} committee` : 'a committee';
  const ch = CHAMBER_NAME[cs[0].chamber] || '', names = cs.map(c => c.name);
  if (names.length > 1) return short ? names.join(' / ') : `${ch} ${names.map(n => n + ' Committee').join(' and ')}`.trim();
  return short ? names[0] : `${ch} ${names[0]} Committee`.trim();
}
// Each committee's own name, for Send's stacked To (R-360 fix 3, C-15): "Senate Health and Human Services Committee".
export const cmteNames = (code, W) => codesOf(code).map(c => cmteInfo(c, W.committees)).filter(Boolean).map(c => `${CHAMBER_NAME[c.chamber] || ''} ${c.name} Committee`.trim());
const theCmte = (code, W) => { const l = cmteLabel(code, W); return /^(the|a) /.test(l) ? l : `the ${l}`; };

// core.js stopOf and deadlineOf, from this bill's own hearings, outcomes and deadlines
export function deadlineOf(b, key, W) {
  const alt = W.deadlines.find(x => x.replaces === key && (x.bills || []).includes(b.bill_number));
  const d = alt || W.deadlines.filter(x => x.key === key && !(x.bills || []).length).slice(-1)[0];
  return d ? { label: d.label, date: d.deadline_date } : null;
}
export const stopOf = (b, W) => billStop(b, { hearings: W.hearings, outcomes: W.outcomes, deadlineFor: key => deadlineOf(b, key, W), now: W.now });
const outcomeOf = (h, W) => W.outcomes[h.id] || null;

// core.js stopFacts and stopDetail: why a bill did not advance, exactly (R-083), with the rule it missed and its date.
const RULE_OF = { triple: 'a bill sent to three or more committees had to reach its last two', lateral: 'a bill had to reach its last committee', decking: 'a bill had to get through all its committees' };
const sameCmte = (h, code) => codesOf(h.committee).some(k => codesOf(code).includes(k));
function stopFacts(b, W) {
  const origin = b.chamber || (String(b.bill_number || '').startsWith('S') ? 'S' : 'H'), other = origin === 'H' ? 'S' : 'H';
  const d = b.died_at_stage || '', m = /^(.*?)\s+(\d+\/\d+\/\d+)$/.exec(b.died_deadline || '');
  const f = { res: isResolution(b), when: m ? shortDate(m[2]) : '', label: m ? m[1] : (b.died_deadline || ''), d, dead: b.stage === 'dead',
    ch: CHAMBER_NAME[/^second/.test(d) ? other : origin] };
  const yr = m ? '20' + m[2].slice(-2) : null;
  const past = W.hearings.filter(h => h.status !== 'cancelled' && new Date(h.scheduled_at) < W.now && (!yr || String(h.scheduled_at).startsWith(yr)));
  const passed = h => /passed/.test(outcomeOf(h, W)?.outcome || '');
  if (b.stage === 'vetoed') return { ...f, kind: 'vetoed' };
  if (b.status_text === 'Failed a vote' || /failed to pass/i.test(b.last_action || '')) return { ...f, kind: 'failed' };
  if (HELD_RE.test(b.last_action || '') || /measure be HELD/i.test(b.last_action || '')) {
    const c = (/committee(?:\(s\))? on\s+([A-Z][A-Z\/]*)/.exec(b.last_action) || [])[1] || null;
    return { ...f, kind: 'held', cmte: c, heard: c ? past.filter(h => sameCmte(h, c)).pop() || null : null };
  }
  if (/^(first|second)_floor$/.test(d)) return { ...f, kind: 'floor' };
  if (/^(second_crossover|conference)$/.test(d)) return { ...f, kind: 'final' };
  const at = stoppedAt(b, { now: W.now });
  if (at) {
    const heard = past.filter(h => sameCmte(h, at.committee)).pop() || null;
    const before = past.filter(h => !sameCmte(h, at.committee) && W.committees[codesOf(h.committee)[0]]?.chamber === at.chamber && passed(h)).pop() || null;
    const all = W.hearings.filter(h => sameCmte(h, at.committee) && new Date(h.scheduled_at) < W.now);
    const prior = !heard && all.filter(h => h.status !== 'cancelled').pop() || null;
    const cancelled = !heard && !prior && all.filter(h => h.status === 'cancelled').pop() || null;
    return { ...f, kind: heard ? 'heard' : 'noHearing', cmte: at.committee, chamber: at.chamber, rule: /_(triple|lateral|decking)$/.exec(d)[1], heard, before,
      cancelled, prior, yr, outcome: heard ? outcomeOf(heard, W)?.outcome || null : null, prev: at.prev, passedN: at.passed, crossed: at.chamber !== origin, origin };
  }
  const last = past.pop() || null;
  return { ...f, kind: last ? 'heard' : 'noHearing', cmte: last ? last.committee : null, heard: last, outcome: last ? outcomeOf(last, W)?.outcome || null : null };
}
export function stopDetail(b, W) {
  const f = stopFacts(b, W), end = f.res ? 'so it was not adopted this year.' : 'so it can’t pass this year.';
  if (f.kind === 'vetoed') return 'Vetoed by the Governor.';
  if (f.kind === 'failed') {
    const o = b.chamber || (String(b.bill_number || '').startsWith('S') ? 'S' : 'H');
    return /^(conference|second_crossover)$/.test(f.d) ? 'It did not pass its final vote, so it can’t pass this year.'
      : /^second/.test(f.d) ? `It did not pass the vote of the full ${CHAMBER_NAME[o === 'H' ? 'S' : 'H']}, so it can’t pass this year.`
      : /^first/.test(f.d) ? `It did not pass the vote of the full ${CHAMBER_NAME[o]}, so it can’t pass this year.` : 'Did not pass a vote.';
  }
  const ended = f.res || /sine die/i.test(f.label);
  const rule = ended ? (f.when ? ` The session ended on ${f.when}, ${end}` : ` The session ended, ${end}`)
    : f.kind === 'floor' ? ` Bills had to pass the full ${f.ch} by ${f.when}, ${end}`
    : f.kind === 'final' ? (/fiscal/i.test(f.label) ? ` Bills that spend money needed a final version by ${f.when}, ${end}` : ` The final version had to be ready for its last vote by ${f.when}, ${end}`)
    : f.rule && f.when ? ` In the ${CHAMBER_NAME[f.chamber]}, ${RULE_OF[f.rule]} by ${f.when}, ${end}`
    : f.when ? ` Its deadline was ${f.when}, ${end}` : ` ${cap(end)}`;
  if (f.kind === 'held') {
    const who = f.cmte ? cap(theCmte(f.cmte, W)) : 'A committee', on = f.heard ? ` on ${dateLong(f.heard.scheduled_at, W)}` : '';
    if (!f.dead && !f.res) return `${who} put it on hold${on} instead of passing it, which usually means it won’t pass this year.`;
    return `${who} ${f.heard ? 'heard it' + on + ' and ' : ''}put it on hold instead of passing it, ${end}`;
  }
  if (f.kind === 'floor') return `Its ${f.ch} committees passed it, but the full ${f.ch} did not vote on it.${rule}`;
  if (f.kind === 'final') return `The House and the Senate each passed it, but in different versions, and they did not agree on one final version.${rule}`;
  if (f.kind === 'noHearing') {
    if (!f.cmte) return `No committee held a hearing on it.${rule}`;
    const did = f.cancelled ? `scheduled a hearing for ${dateLong(f.cancelled.scheduled_at, W)}, then cancelled it and did not hold another`
      : f.prior ? `heard it on ${dateLong(f.prior.scheduled_at, W)}${outcomeOf(f.prior, W)?.outcome === 'deferred' ? ' and put it on hold' : ''}, and did not take it up again${f.yr ? ` in ${f.yr}` : ''}`
      : 'never scheduled a hearing on it';
    return f.before ? `${cap(theCmte(f.before.committee, W))} passed it on ${dateLong(f.before.scheduled_at, W)}, but the next committee, ${theCmte(f.cmte, W)}, ${did}.${rule}`
      : f.prev && !f.prior && !f.cancelled ? (f.passedN > 1 ? `It passed its first ${f.passedN} ${CHAMBER_NAME[f.chamber]} committees, but the next one, ${theCmte(f.cmte, W)}, ${did}.${rule}`
        : `${cap(theCmte(f.prev, W))} passed it, but the next committee, ${theCmte(f.cmte, W)}, ${did}.${rule}`)
      : f.crossed && !f.prior && !f.cancelled ? `It passed the ${CHAMBER_NAME[f.origin]}, but ${theCmte(f.cmte, W)} ${did}.${rule}`
      : `${cap(theCmte(f.cmte, W))} ${did}.${rule}`;
  }
  if (f.kind === 'heard') {
    const who = cap(theCmte(f.heard.committee, W)), on = dateLong(f.heard.scheduled_at, W);
    const hc = CHAMBER_NAME[W.committees[codesOf(f.heard.committee)[0]]?.chamber];
    if (/passed/.test(f.outcome || '') && /recommendation was not adopted/i.test(b.last_action || '') && hc) return `${who} passed it on ${on}, but the full ${hc} voted not to accept the committee’s report.${rule}`;
    if (/passed/.test(f.outcome || '') && /measure be PASSED/i.test(b.last_action || '') && hc) return `${who} passed it on ${on}, but its report did not reach the full ${hc} in time.${rule}`;
    if (/passed/.test(f.outcome || '')) return `${who} passed it on ${on}, but it did not reach its next step in time.${rule}`;
    if (/deleted the measure from decision making/i.test(b.last_action || '')) return `${who} was due to decide on it on ${on}, then took it off the list.${rule}`;
    if (f.outcome === 'deferred') return `${who} heard it on ${on} and put it on hold instead of passing it.${rule}`;
    return `${who} heard it on ${on} but did not vote to pass it.${rule}`;
  }
  return rule.trim();
}
// core.js sameIdeaWords: a stopped bill whose companion, or another bill on the same HIPHI issue from the other chamber,
// became law (X4-4: HB 2121 stopped, the same ban became law as SB 2175, Act 189). L from one/data.js (the RPC's companions
// and same_idea rows).
export const sameIdeaWords = L => L.issue ? `On “${L.issue}”, ${spaced(L.num)} became law${L.act ? ` (Act ${L.act})` : ''}.` : `The same idea became law as ${spaced(L.num)}${L.act ? `, Act ${L.act}` : ''}.`;

// The bill screen's "where it stands" lines and its one action, from core.js plainStatus's cases (R-360):
//   over:   'law' | 'passed' | 'stopped' | ''      a bill that is done for the year has no button, only a plain line
//   action: 'testimony' | 'email' | ''            Send testimony while a hearing's deadline is open; Email the chair while
//                                                 it waits in a committee with no hearing set; else no button
//   lines:  [{ icon: 'capitol' | 'calendar', lead, rest }]   lead in bold, rest after it
//   st:     stops.js's step, for the hearing and the committee
// C-15's word list: "did not advance", never "stopped" or "dead", in what the page says; committees by name, never code.
export function standing(b, W, sameLaw = null) {
  const st = stopOf(b, W), res = isResolution(b);
  const out = (over, lead, rest = '') => ({ over, action: '', st, lines: [{ icon: over === 'stopped' ? 'flag' : 'capitol', lead, rest }] });
  if (b.stage === 'enacted' || st.phase === 'law') return out('law', res ? 'This resolution was adopted.' : 'This bill passed.', res ? '' : 'It became law.');
  if (b.stage === 'ballot' || st.phase === 'ballot') return out('passed', 'This bill passed.', 'The voters decide on it in the November election.');
  if (b.stage === 'governor' || st.phase === 'governor') return out('passed', 'This bill passed.', 'It is on the Governor’s desk.');
  if (b.stage === 'vetoed' || st.phase === 'vetoed') return out('stopped', 'This bill did not advance this year.', 'Vetoed by the Governor.');
  if (!alive(b) || st.phase === 'dead') return out('stopped', res ? 'This resolution was not adopted this year.' : 'This bill did not advance this year.',
    stopDetail(b, W) + (sameLaw ? ' ' + sameIdeaWords(sameLaw) : ''));
  const ch = CHAMBER_NAME[st.chamber] || '', other = st.chamber === 'H' ? 'Senate' : 'House';
  if (st.phase === 'conference') return { ...out('', 'The House and Senate passed different versions.', 'They are working out one version now.'), over: '' };
  if (st.phase === 'floor') return { ...out('', `Through its ${ch} committees.`, `Next is a vote of the full ${ch}.`), over: '' };
  // In committee. The first line says where: the chamber it passed, and the committee it is with (a joint hearing names each
  // committee, "..., together"; C-15). The second says the hearing or the wait.
  // Two or more committees together are counted here, not named (C-15: "the two committees hear it together"); the letter's
  // header names each. One committee keeps its name. A committee that has not heard it yet "hears it next".
  const many = codesOf(st.committee).length > 1, count = ['', 'One', 'Two', 'Three', 'Four'][codesOf(st.committee).length] || String(codesOf(st.committee).length);
  const ahead = st.hearingState === 'scheduled' || !st.hearingState || st.hearingState === 'none';
  const where = !st.committee ? `Waiting to be sent to a ${ch} committee.`
    : many ? (ahead ? `${count} ${ch} committees hear it next.` : `Now with ${count.toLowerCase()} ${ch} committees.`)
    : `Now with ${theCmteName(st.committee, W.committees)}.`;
  const lines = [st.leg === 'second' ? { icon: 'capitol', lead: `Passed the ${other}.`, rest: where } : { icon: 'capitol', lead: `In the ${ch}.`, rest: where }];
  let action = '';
  if (st.hearingState === 'scheduled') {
    const d = dueInfo(st.hearing, W), on = dateLong(st.hearing.scheduled_at, W);
    // A hearing with no deadline posted yet still takes testimony until it starts: the Capitol opens the form with the notice.
    action = !d || !d.late ? 'testimony' : '';
    if (d && !d.late) {
      // The deadline leads (R-360 fix pass): sendBy's words, as Home, Bills and This week say it, then who hears it and when,
      // and that no one has to go. Within a day the honest countdown follows (R-046). This line names the committees, so the
      // line under it says only where the bill has been and is: "Passed the House. Now in the Senate." (A-14: say it once).
      const iso = st.hearing.testimony_deadline, left = new Date(iso).getTime() - W.now, by = sendBy(iso, W.now);
      const who = many ? `${count} ${ch} committees hear it ${on}.` : `${cap(theCmte(st.hearing.committee, W))} hears it ${on}.`;
      lines.unshift({ icon: 'calendar', lead: `${by.text}.`, rest: `${d.soon ? `That’s ${inHours(left)}. ` : ''}${who} You don’t need to go.`, soon: by.soon });
      lines[1] = st.leg === 'second' ? { icon: 'capitol', lead: `Passed the ${other}.`, rest: `Now in the ${ch}.` } : { icon: 'capitol', lead: `In the ${ch}.`, rest: '' };
    } else lines.push({ icon: 'calendar', lead: `Hearing ${on} at ${timeWord(st.hearing.scheduled_at)}.`, rest: d ? d.text + '.' : t('bill.before'), soon: !!d?.soon });
  } else if (st.hearingState === 'held') {
    lines.push({ icon: 'calendar', lead: `Heard ${dateLong(st.hearing.scheduled_at, W)}.`, rest: `Waiting for ${many ? 'their' : 'its'} decision.` });
  } else if (st.hearingState === 'decided') {
    const o = st.decided, ok = /passed/.test(o), verb = o === 'passed_amended' ? 'Passed with changes' : ok ? 'Passed' : o === 'deferred' ? 'Put on hold' : 'Sent back';
    lines.push({ icon: 'calendar', lead: `${verb} ${dateLong(st.hearing.scheduled_at, W)}.`, rest: ok ? 'Next it moves on to its next step.' : '' });
  } else if (st.committee) {
    const dl = st.deadline && !st.deadline.missed ? st.deadline : null;
    lines.push({ icon: 'calendar', lead: 'Waiting for a hearing.', rest: dl ? `If it is not heard by ${dateLong(dl.date + 'T12:00:00-10:00', W)}, it can’t pass this year.` : '' });
    action = 'email';
  }
  return { over: '', action, st, lines };
}
