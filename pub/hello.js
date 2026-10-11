// The hello letter (R-080, reworked R-172): a one-time note to a person's own senator and representative, written from the
// issues they follow and where they stand. The walkthrough (helper.js, mode 'intro') and the legislators page (people.js)
// both write it with helloLetter below, so the two can never say different things (Nate 10/10).
//
// The letter names ONE issue, the one that matters most to the person. Someone who follows many issues is not asked to
// write about all of them: they pick the one (helloFacts' default is the issue of a bill they took a stand on, else the
// first issue they follow), and the other issues get one short line. Their reason is optional. When it is blank the
// letter does not mention it, and it closes with a thank-you line, so no blank or placeholder ever reaches a legislator.
import { S, followedIssues, issuesOf, sessionInfo, spaced, nick } from './core.js';
import { aWords, needsSelf } from './titles.js';

// The line the letter closes with when the person has written no sign-off of their own (Nate 10/10).
export const THANKS = 'Mahalo for your work for our district.';

export const sentence = s => { const t = String(s || '').replace(/\s+/g, ' ').trim(); return t && !/[.!?…"”)]$/.test(t) ? t + '.' : t; };
export const closingOf = c => { const t = String(c || '').replace(/\s+/g, ' ').trim(); return t && !/[,.!]$/.test(t) ? t + ',' : t; };
export const andList = xs => xs.length <= 1 ? xs.join('') : xs.length === 2 ? `${xs[0]} and ${xs[1]}` : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;

// "House District 22", or "Senate District 11 and House District 22": where they live, never the street (their address
// was never kept). Only the districts of the people the letter goes to: to is [{ leg }].
export function districtWords(to) {
  const ds = to.map(t => t.leg).filter(Boolean).sort((a, b) => a.chamber === 'S' ? -1 : b.chamber === 'S' ? 1 : 0).map(l => `${l.chamber === 'S' ? 'Senate' : 'House'} District ${l.district}`);
  return andList([...new Set(ds)]);
}
// The subject for the hello. "your constituent" is only true for a person's own lawmaker.
export const helloSubject = (to, own) => own ? `A question from your constituent in ${districtWords(to) || 'your district'}` : 'A question from a Hawaiʻi resident';

// A bill in the letter: "HB 1523 (Disposable e-cigarette ban)".
const billWords = b => nick(b) ? `${spaced(b.bill_number)} (${nick(b)})` : spaced(b.bill_number);

// What the letter can say about this person, the same for the walkthrough and the legislators page. pick: the issue id
// the person chose ('' for the default). issues: the issues they follow (the chips to pick from; one or none means no
// picking step). top: the issue the letter names. bill: at most one bill they took a stand on that is under that issue.
export function helloFacts(pick = '') {
  const all = [...new Map([...S.bills, ...Object.values(S.extra || {})].map(b => [b.id, b])).values()];
  const st = id => (S.stances || {})[id];
  const support = all.filter(b => st(b.id) === 'support'), oppose = all.filter(b => st(b.id) === 'oppose');
  const stood = [...support, ...oppose], followed = followedIssues();
  const first = support[0] || oppose[0] || null, firstIssues = first ? issuesOf(first) : [];
  // The default: the issue of the first bill they took a stand on (when they follow that issue), else the first they follow.
  const standIssue = firstIssues.find(i => followed.some(f => f.id === i.id)) || null;
  const def = standIssue || followed[0] || firstIssues[0] || null;
  const top = followed.find(i => i.id === pick) || def;
  const bill = top ? stood.find(b => issuesOf(b).some(i => i.id === top.id)) || null : null;
  return { issues: followed, top, bill, billSupport: !!bill && st(bill.id) === 'support',
    others: followed.filter(i => !top || i.id !== top.id).map(i => i.name).slice(0, 2), off: sessionInfo().phase !== 'in' };
}

// The letter. to: [{ greet: 'Senator Smith' }] (who it is addressed to). name: their name ('' leaves it out). titles: the
// "I'm a..." titles they chose for this letter. own: the letter goes to their own lawmakers, so it says they live in the
// district (where: its words, "House District 22"). reason: their own words ('' leaves the sentence out). closing: their
// sign-off ('' gives the thank-you line). facts: helloFacts().
export function helloLetter({ to = [], name = '', titles = [], own = false, where = '', reason = '', closing = '', facts }) {
  const n = String(name || '').trim(), top = facts.top ? facts.top.name : '';
  const greet = to.length ? `Aloha ${andList(to.map(t => t.greet))},` : 'Aloha,';
  const titlePart = titles.length ? `, ${aWords(titles)}${needsSelf(titles) ? ' writing for myself' : ''}` : '';
  const live = own ? `in your district${to.length > 1 ? 's' : ''}${where ? ` (${where})` : ''}` : '';
  const who = n && live ? `I’m ${n}${titlePart}, and I live ${live}.` : n ? `I’m ${n}${titlePart}.` : live ? `I live ${live}.` : '';
  const bill = facts.bill ? (facts.billSupport ? `${billWords(facts.bill)} would help, and I support it.` : `I oppose ${billWords(facts.bill)}.`) : '';
  const focus = top ? `The health issue that matters most to me: ${top}. ${bill}`.trim()
    : 'I care about the health of our community, and I follow the health bills that come before you.';
  const off = facts.off ? ' before the session opens in January' : '';
  const ask = top ? `Where do you stand on it? I’d be grateful to hear back${off}.`
    : `What health issues are you working on${facts.off ? ' for the next session' : ' this session'}? I’d be grateful to hear back.`;
  const others = facts.others.length ? `I also follow ${andList(facts.others)}.` : '';
  const sign = closingOf(closing) || THANKS;
  return [greet, who, focus, sentence(reason), ask, others, [sign, n].filter(Boolean).join('\n')].filter(Boolean).join('\n\n');
}
