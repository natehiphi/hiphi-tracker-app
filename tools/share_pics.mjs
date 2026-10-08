// The share picture versions (R-183, Nate 10/6: "go for R-183 and make every template"): the issue-up-front picture and the
// twelve ideas he approved, each a template filled in from the bill's own data and drawn only where it is true. This file
// decides, for one bill and one ask, WHICH versions fit and WHAT each says; tools/og_images.py draws what it decides.
// Pure: no network, no files (tools/share_pages.mjs reads the data, tests/share_pics_test.mjs checks every bill).
//
// The versions are the arms of the 'pic' test (pub/variant.js, backend migration 155). 'today' is the picture as built in
// R-169 (pub/og/<look>/<issue>.jpg), drawn by og_images.py's own code and not by a spec here.
//
//   issue      the issue up front: its name as the headline, the ask as one coloured line, a drawing per topic (R-197 may
//              replace the drawing with one per issue)
//   sign       1 the rally sign: the issue's slogan on a placard             needs the issue's checked slogan
//   calendar   2 the tear-off calendar: the deadline's date                  needs a date the tracker has
//   letter     3 the letter itself: a note to the chair, in handwriting       needs a side (support or oppose)
//   text       4 a text from a friend
//   neighbors  5 neighbors with a sign
//   islands    6 every island has a say                                       needs the issue's checked island
//   before     7 before and after                                             needs the issue's checked before and after
//   here       8 you are here on the bill's road                              needs a bill still alive, or a law
//   ticket     9 admit one: the hearing as a ticket                           needs a hearing set (testimony only)
//   crowd      10 the crowd count                                             needs 10 or more people (never a count under 10)
//   stand      11 where do you stand?                                         following only
//   postcard   12 aloha from the Capitol
//
// A bill HIPHI opposes turns every ask around ("Stop ...", "Ask the chair not to hear it"). Every word on a picture that
// states a fact (a date, a step, a committee, a chair, a count) comes from the same readings the card's title uses
// (share_cards.mjs billState and cardFor), so the picture can never disagree with the words under it.
import { isResolution, CHAMBER_NAME } from '../stops.js';
import { committeeWords, dayWords, timeWords } from './share_cards.mjs';
import { createHash } from 'node:crypto';

export const ARMS = ['today', 'issue', 'sign', 'calendar', 'letter', 'text', 'neighbors', 'islands', 'before', 'here', 'ticket', 'crowd', 'stand', 'postcard'];
// The words staff read on the Tests page (backend ab_tests.arm_names) and the gallery.
export const ARM_NAMES = {
  today: 'Today’s picture: the ask in large words', issue: 'The issue up front', sign: '1 · The rally sign', calendar: '2 · The tear-off calendar',
  letter: '3 · The letter itself', text: '4 · A text from a friend', neighbors: '5 · Neighbors with a sign', islands: '6 · Every island has a say',
  before: '7 · Before and after', here: '8 · You are here', ticket: '9 · Admit one', crowd: '10 · The crowd count', stand: '11 · Where do you stand?',
  postcard: '12 · Aloha from the Capitol',
};
// Bump when a template's look changes, so every picture of it is drawn again (the file name carries a hash of the spec).
export const TEMPLATE_V = 1;
export const SIDE_LOOKS = ['testify', 'ask', 'hold', 'floor-yes', 'floor-no', 'conference-yes', 'conference-no', 'governor-sign', 'governor-veto', 'follow', 'law'];

// ---- words ----
// Title case for headings on a picture (R-186; the same rule as og_images.py's title() used for issue names): each word and
// each part of a hyphenated one, but not a, an, the, and, or, nor, but, for, so, yet or a short preposition unless first
// or last; a word that already has a capital (FDA, SNAP, Hawaiʻi) is left as written.
const SMALL = new Set('a an the and or nor but for so yet as at by in of off on per to via vs'.split(' '));
export function titleCase(t) {
  const ws = String(t).trim().split(/\s+/);
  const cap = w => /[A-Z]/.test(w) ? w : w.replace(/[\p{L}]/u, c => c.toUpperCase());
  return ws.map((w, i) => (i > 0 && i < ws.length - 1 && SMALL.has(w.toLowerCase())) ? w : w.split('-').map(cap).join('-')).join(' ');
}
const lower1 = s => s ? s[0].toLowerCase() + s.slice(1) : s;
const spaced = n => String(n).replace(/^([A-Z]+)\s*(\d)/, '$1 $2');
const cut = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…'; };
const hst = (d, o) => new Intl.DateTimeFormat('en-US', { timeZone: 'Pacific/Honolulu', ...o }).format(d);
// A day as the calendar page needs it. d: an ISO timestamp or a 'YYYY-MM-DD' day (the deadlines table's).
export function dayParts(d) {
  const t = /^\d{4}-\d\d-\d\d$/.test(d) ? new Date(`${d}T12:00:00-10:00`) : new Date(d);
  return { dow: hst(t, { weekday: 'long' }), day: hst(t, { day: 'numeric' }), month: hst(t, { month: 'long' }), short: dayWords(t.toISOString()) };
}

// Where a bill stands, as the numbered road of picture 8: the node it is at (0 introduced, 1 its first chamber's committees,
// 2 that chamber's floor vote, 3 the other chamber, 4 the final version, 5 the Governor, 6 past the end: law). null where
// no true road can be drawn (stopped, vetoed, on the ballot, a resolution).
export function roadNode(b, st) {
  if (isResolution(b)) return null;
  switch (st.phase) {
    case 'law': return 6;
    case 'dead': case 'vetoed': case 'ballot': return null;
    case 'governor': return 5;
    case 'conference': return 4;
    case 'floor': return st.leg === 'second' ? 3 : 2;
    case 'committee': return st.leg === 'second' ? 3 : 1;
    default: return null;
  }
}
export const originOf = b => b.chamber || (String(b.bill_number || '').startsWith('S') ? 'S' : 'H');
export function roadLabels(b) {
  const o = CHAMBER_NAME[originOf(b)], x = CHAMBER_NAME[originOf(b) === 'H' ? 'S' : 'H'];
  return ['Introduced', `${o} Committees`, `Full ${o} Vote`, x, 'Final Version', 'Governor'];
}

// People counted into a tier, so a picture shows "50+" and does not change with every new person (and never shows a count
// under 10: public_action_counts already hides those). Returns 0 under 10.
const TIERS = [10, 25, 50, 100, 200, 300, 500, 750, 1000, 1500, 2000, 3000, 5000, 10000];
export const tierOf = n => TIERS.filter(t => +n >= t).pop() || 0;

// The lines each ask says on the smaller places of a template.
function sideWords(look) {
  const no = /-no$|-veto$|^hold$/.test(look);
  return { no };
}
const whoOf = st => st.phase === 'floor' && st.chamber === 'S' ? 'senator' : st.phase === 'floor' && st.chamber === 'H' ? 'representative' : 'legislator';

// ---- the one reading every template shares ----
// input: { b (a public_all_bills row, or null on an issue's own page), ask ('testify' ...), state (billState), card (cardFor),
//          ctx { committees, issue, now }, words ({ slogan, before, after, island } | null, from the issue's share words),
//          counts ({ testimonies, emails, followers } | null), practice (the counts are made up for the practice copy) }
// words: { slogan, before, after, island ('all' | [keys]), slogan_ok, fact_ok }; the live site is given only checked fields.
export function readIt(inp) {
  const { b, ask, state, card, ctx = {}, words = null, counts = null } = inp;
  const issue = ctx.issue || null, look = card.image;
  const st = state?.st || null, side = state?.side || '';
  const issueSide = issue?.stance === 'oppose' ? 'oppose' : issue?.stance === 'support' ? 'support' : '';
  // The side the picture speaks from: the bill's own, else (on an issue's page) HIPHI's stance on the issue.
  const dir = side === 'support' || side === 'oppose' ? side : b ? '' : issueSide;
  const num = b ? spaced(String(b.bill_number).replace(/\s/g, '')) : '';
  const subject = (b && b.hiphi_nickname) || (issue && issue.name) || (b ? cut(b.hiphi_summary || b.description || '', 60) : '');
  const h = state?.open || null, due = h && h.testimony_deadline && new Date(h.testimony_deadline).getTime() > (state.now ?? Date.now()) ? h.testimony_deadline : null;
  const deadline = st && st.deadline && !st.deadline.missed && st.deadline.date ? st.deadline.date : null;
  return { b, ask, look, st, state, side, dir, issue, issueSide, num, subject, h, due, deadline, words, counts, ctx, practice: !!inp.practice, no: sideWords(look).no };
}

// A picture drawn from words staff have not checked yet (only the practice copy ever has any) says so on itself.
const unchecked = (r, v) => !!r.words && ((v === 'sign' || v === 'islands') ? r.words.slogan_ok === false : v === 'before' ? r.words.fact_ok === false : false);
const base = (r, v, extra) => ({ v, look: r.look, ...extra, ...(unchecked(r, v) ? { tag: 'Draft words' } : {}) });
const sameSide = r => !!r.words && !!r.dir && r.issueSide === r.dir;   // a slogan or a fact is written in the issue's direction

// ---- the templates: each returns a spec (everything the drawing needs, as final words) or null ----
const T = {
  // The issue up front (R-183, Nate's answers 10/6): the issue's name as the headline, the ask as one coloured line under it,
  // a drawing for the topic. Needs only an issue.
  issue(r) {
    if (!r.issue) return null;
    return { v: 'issue', look: r.look, name: titleCase(r.issue.name), cat: r.issue.category || '' };
  },
  sign(r) {
    if (!sameSide(r) || !r.words.slogan) return null;
    const look = r.look;
    const foot = look === 'testify' ? (r.due ? `Add your voice by ${dayWords(r.due)}` : 'Add your voice before the vote')
      : titleCase(LOOK_FOOT[look] || '');
    return base(r, 'sign', { slogan: r.words.slogan.toUpperCase(), kicker: LOOK_SHORT[look], foot });
  },
  calendar(r) {
    if (!r.b || !r.st) return null;
    const subj = titleCase(r.subject);
    let date = null, head = '', sub = '';
    if (r.ask === 'testify' && r.due) {
      date = r.due; head = `Last Day to Speak Up ${r.dir === 'oppose' ? 'Against' : 'on'} ${subj}`;
      sub = `${r.num} · Testimony is due at ${timeWords(r.due)}. It takes a few minutes, and we help you write it.`;
    } else if (r.ask === 'ask' && r.deadline) {
      date = r.deadline; head = `Last Day for a Hearing on ${subj}`;
      sub = `${r.num} · ${r.dir === 'oppose' ? 'Ask the chair not to hear it.' : 'Without a hearing, it can’t pass this year.'} A short email takes about 2 minutes.`;
    } else if (r.ask === 'floor' && r.deadline) {
      date = r.deadline; head = `Last Day for a Vote on ${subj}`;
      sub = `${r.num} · It goes to a vote of the full ${CHAMBER_NAME[r.st.chamber] || 'House or Senate'}. A short email to your own ${whoOf(r.st)} takes about 2 minutes.`;
    } else if (r.ask === 'conference' && r.deadline) {
      date = r.deadline; head = `The Final Version of ${subj} Is Due`;
      sub = `${r.num} · The House and Senate are working out one final version. A short email takes about 2 minutes.`;
    } else return null;
    return base(r, 'calendar', { ...(({ dow, day, month }) => ({ dow, day, month }))(dayParts(date)), head, sub });
  },
  letter(r) {
    if (!r.b || !r.st || !(r.dir === 'support' || r.dir === 'oppose') || r.ask === 'follow') return null;
    const no = r.dir === 'oppose', look = r.look, nick = r.b.hiphi_nickname, num = r.num, name = nick ? `${nick} (${num})` : num;
    // To whom: the chair of the committee this ask goes to (the full name: a last name cannot be told from a two-part one),
    // your own legislator for a floor vote, lawmakers, the Governor.
    let greet;
    if (r.ask === 'testify' || r.ask === 'ask') {
      const codes = String((r.ask === 'testify' ? r.h?.committee : r.st.committee) || '').split('/').map(c => c.trim()).filter(Boolean);
      const chairs = codes.map(c => r.ctx.committees?.[c]?.chair).filter(Boolean);
      // One committee: its chair by full name (a last name cannot be told from a two-part one). Joint committees: "Chairs".
      greet = chairs.length === 1 && codes.length === 1 ? `Aloha Chair ${chairs[0]},` : codes.length > 1 ? 'Aloha Chairs,' : 'Aloha Chair,';
    } else if (r.ask === 'floor') greet = `Aloha ${r.st.chamber === 'S' ? 'Senator' : r.st.chamber === 'H' ? 'Representative' : 'Legislator'},`;
    else if (r.ask === 'conference') greet = 'Aloha lawmakers,';
    else greet = 'Aloha Governor,';
    const open = { testify: `I ${no ? 'oppose' : 'support'} ${name}.`, ask: no ? `I oppose ${name}. Please do not schedule it for a hearing.` : `Please give ${name} a hearing.`,
      floor: `Please vote ${no ? 'no' : 'yes'} on ${name}.`, conference: `Please ${no ? 'do not pass' : 'pass'} the final version of ${name}.`,
      governor: `Please ${no ? 'veto' : 'sign'} ${name}.` }[r.ask];
    // One of HIPHI's own talking points (already on the bill's page), in its first sentence, when one is short enough.
    const pts = (r.b.hiphi_points || []).map(p => String(p).trim()).filter(Boolean);
    const first = s => (/^.*?[.!?](?=\s|$)/.exec(s) || [s])[0];
    const pt = pts.map(first).find(p => p.length <= 118) || '';
    const body = `${open}${pt ? ` ${pt}` : ' It matters to me and my family.'}`;
    const sub = r.ask === 'testify' ? `${name}. A short letter to ${r.h && !String(r.h.committee).includes('/') ? committeeWords(r.h.committee, r.ctx.committees).replace(/^the /, '') : 'the committee'}${r.due ? `, due ${dayWords(r.due)}` : ''}. We help you write it.`
      : `${name}. A short ${r.ask === 'governor' ? 'message' : 'email'}, in your own words. We help you write it.`;
    return base(r, 'letter', { greet, body, head: 'Your Voice, in Your Own Words', sub });
  },
  text(r) {
    if (!r.subject) return null;
    const subj = titleCase(r.subject), no = r.dir === 'oppose';
    const line = r.ask === 'testify' ? (r.due ? `Testimony is due ${dayWords(r.due)}. It takes a few minutes.` : 'There’s a hearing coming. Testimony takes a few minutes.')
      : r.ask === 'ask' ? (no ? 'It’s waiting for a hearing. A short email can ask the chair not to hear it.' : 'It needs a hearing or it can’t pass this year. A short email takes 2 minutes.')
      : r.ask === 'floor' ? 'A vote is coming. A short email to your legislator takes 2 minutes.'
      : r.ask === 'conference' ? 'The final version is being written. A short email takes 2 minutes.'
      : r.ask === 'governor' ? 'It’s on the Governor’s desk. A short message takes 2 minutes.'
      : r.look === 'law' ? 'Good news: it became law. Follow what’s next.' : 'Follow it, and we’ll tell you when your voice can count.';
    return base(r, 'text', { head: no ? `Can You Help Say No to ${subj}?` : `Can You Help With ${subj}?`, b1: `Have you seen this? ${cut(r.subject, 70)}`, b2: line, reply: 'Done!', sub: `${r.num ? `${r.num} · ` : ''}${LOOK_SHORT[r.look]}` });
  },
  neighbors(r) {
    if (!r.subject) return null;
    return base(r, 'neighbors', { sign: cut(r.subject, 44), head: 'Speak Up With Your Neighbors', sub: `${r.num ? `${r.num} · ` : ''}${r.ask === 'testify' && r.due ? `Add your voice by ${dayWords(r.due)}. ` : ''}${LOOK_SHORT[r.look]}` });
  },
  islands(r) {
    if (!r.words || r.words.island == null || !r.subject) return null;
    const isl = r.words.island, names = { kauai: 'Kauaʻi', oahu: 'Oʻahu', maui: 'Maui', molokai: 'Molokaʻi', lanai: 'Lānaʻi', hawaii: 'Hawaiʻi Island' };
    const lit = isl === 'all' ? [] : [].concat(isl).filter(k => names[k]);
    if (isl !== 'all' && !lit.length) return null;
    const list = lit.map(k => names[k]);
    const head = !lit.length ? 'Every Island Has a Say' : `${list.length > 1 ? `${list.slice(0, -1).join(', ')} and ${list.at(-1)} Have` : `${list[0]} Has`} a Say`;
    return base(r, 'islands', { lit, head, subject: titleCase(r.subject), sub: `${r.num ? `${r.num} · ` : ''}${LOOK_SHORT[r.look]}` });
  },
  before(r) {
    if (!sameSide(r) || !r.words.before || !r.words.after) return null;
    // "If it passes" is only true of a bill still alive; an issue's own page says "The goal" (or "The worry" for one HIPHI opposes).
    if (r.b && (!r.st || ['dead', 'vetoed', 'law', 'ballot'].includes(r.st.phase))) return null;
    const label = r.b ? `If ${r.num} Passes` : r.dir === 'oppose' ? 'The Worry' : 'The Goal';
    const tail = r.ask === 'testify' ? `${r.due ? `Testimony is due ${dayWords(r.due)}. ` : ''}Speak up in a few minutes.` : LOOK_SHORT[r.look];
    return base(r, 'before', { beforeLabel: 'Today', beforeText: r.words.before, afterLabel: label, afterText: r.words.after, tail, bad: r.dir === 'oppose', cat: r.issue?.category || '' });
  },
  here(r) {
    if (!r.b || !r.st) return null;
    const node = roadNode(r.b, r.st); if (node == null) return null;
    const labels = roadLabels(r.b);
    const hearing = (node === 1 || node === 3) && r.st.phase === 'committee' && r.ask === 'testify' && r.h;
    const steps = labels.map((l, i) => ({ label: hearing && i === node ? 'Committee Hearing' : l, at: i < node ? 'done' : i === node ? 'here' : 'todo' }));
    const subj = titleCase(r.subject);
    const sub = r.ask === 'testify' ? `${r.num} · The committee hears it ${r.h ? dayWords(r.h.scheduled_at) : 'soon'}. Testimony takes a few minutes.`
      : r.ask === 'ask' ? `${r.num} · ${r.dir === 'oppose' ? 'It is waiting for a hearing. Ask the chair not to hear it.' : 'It needs a hearing, or it can’t pass this year.'}`
      : r.ask === 'floor' ? `${r.num} · It goes to a vote of the full ${CHAMBER_NAME[r.st.chamber] || 'House or Senate'}. ${LOOK_SHORT[r.look]}`
      : r.ask === 'conference' ? `${r.num} · The House and Senate are writing one final version. ${LOOK_SHORT[r.look]}`
      : r.ask === 'governor' ? `${r.num} · It passed the Legislature and is on the Governor’s desk.`
      : node === 6 ? `${r.num} · It became law. Follow what’s next.` : `${r.num} · Follow it, and we’ll tell you when your voice can count.`;
    return base(r, 'here', { head: node === 6 ? `${subj} Made It All the Way` : `Where ${subj} Stands`, steps, marker: node === 6 ? 'Law!' : 'You Are Here', sub });
  },
  ticket(r) {
    if (r.ask !== 'testify' || !r.h || !r.b) return null;
    const cm = titleCase(committeeWords(r.h.committee, r.ctx.committees).replace(/^the /, ''));
    return base(r, 'ticket', { kicker: 'ADMIT ONE · YOUR VOICE', head: titleCase(r.subject), line1: `${cm} · ${dayWords(r.h.scheduled_at)}`, line2: 'Hawaiʻi State Capitol, or from your phone', num: r.num, minutes: 'A few minutes' });
  },
  crowd(r) {
    const c = r.counts; if (!c) return null;
    const n = r.ask === 'testify' ? c.testimonies : r.ask === 'follow' ? c.followers : ['ask', 'floor', 'conference', 'governor'].includes(r.ask) ? c.emails : null;
    const tier = tierOf(n); if (!tier || !r.subject) return null;
    if (r.ask === 'follow' && !r.issue) return null;
    const verb = r.ask === 'follow' ? 'follow' : r.dir === 'oppose' ? 'spoke up against' : 'spoke up for';
    const tail = r.ask === 'follow' ? 'Follow it too. It’s free.' : r.ask === 'testify' && r.due ? `Add yours by ${dayWords(r.due)}. A few minutes.` : `Add yours. ${LOOK_SHORT[r.look]}`;
    return base(r, 'crowd', { n: `${tier.toLocaleString('en-US')}+`, line: r.ask === 'follow' ? `neighbors follow ${r.issue.name}` : `neighbors ${verb} ${r.subject}`, sub: `${r.num ? `${r.num} · ` : ''}${tail}`, ...(r.practice ? { tag: 'Practice number' } : {}) });
  },
  stand(r) {
    if (r.ask !== 'follow' || r.look === 'law' || !r.subject) return null;
    return base(r, 'stand', { head: `${titleCase(r.subject)}?`, sub: `${r.num ? `${r.num}. ` : ''}Lawmakers want to hear from you. Tell us where you stand, in a few minutes.`, buttons: ['I support it', 'I oppose it', 'Not sure yet'] });
  },
  postcard(r) {
    if (!r.subject) return null;
    const no = r.dir === 'oppose', subj = r.b?.hiphi_nickname ? r.b.hiphi_nickname : r.subject, n = r.num;
    const note = r.ask === 'testify' ? `Wish you were here for ${n}: ${lower1(subj)}. ${r.due ? `Send your note by ${dayWords(r.due)}!` : 'Send your note before the hearing!'}`
      : r.ask === 'ask' ? (no ? `Ask the chair not to hear ${n}: ${lower1(subj)}. A short email takes 2 minutes.` : `Ask the chair for a hearing on ${n}: ${lower1(subj)}. A short email takes 2 minutes.`)
      : r.ask === 'floor' ? `Ask your legislator to vote ${no ? 'no' : 'yes'} on ${n}: ${lower1(subj)}. A short email takes 2 minutes.`
      : r.ask === 'conference' ? `Ask lawmakers ${no ? 'not to pass' : 'to pass'} the final version of ${n}: ${lower1(subj)}.`
      : r.ask === 'governor' ? `Ask the Governor to ${no ? 'veto' : 'sign'} ${n}: ${lower1(subj)}.`
      : r.look === 'law' ? `${subj} became law! Follow what’s next.` : `Follow ${lower1(subj)} and we’ll tell you when your voice can count.`;
    return base(r, 'postcard', { big: 'Aloha From the Capitol', note, from: 'Aloha, HIPHI', cat: r.issue?.category || '' });
  },
};
const LOOK_SHORT = {}, LOOK_FOOT = {};
// The looks' short lines come from og_looks.json, set by loadLooks (the page builder reads the file; the tests pass it in).
export function loadLooks(looks) { for (const [k, v] of Object.entries(looks)) { if (k.startsWith('_')) continue; LOOK_SHORT[k] = v.short; LOOK_FOOT[k] = v.foot; } }

// All versions that fit this bill and ask, as { arm: spec }. today is not here.
export function specsFor(inp) {
  const r = readIt(inp), out = {};
  // A page for an ask that is no longer the bill's own (a bill that has its hearing now still has b/HB1-ask) keeps today's
  // picture: a version would say "needs a hearing" of a bill that has one.
  if (r.b && r.ask !== 'follow' && r.state && r.state.ask !== r.ask) return out;
  for (const arm of ARMS) { if (arm === 'today') continue; const s = T[arm](r); if (s) out[arm] = s; }
  return out;
}
export const specKey = spec => {
  const j = JSON.stringify([TEMPLATE_V, Object.keys(spec).sort().map(k => [k, spec[k]])]);
  return createHash('sha1').update(j).digest('hex').slice(0, 12);
};
// Where a spec's picture lives under pub/: one file for every bill and ask that says the same words.
export const picPath = spec => `og/t/${spec.v}/${specKey(spec)}.jpg`;
