// The hello letter (R-080, reworked R-172): a one-time note to a person's own senator and representative, written from the
// issues they follow and where they stand. The walkthrough (helper.js, mode 'intro') and the legislators page (people.js)
// both write it with helloLetter below, so the two can never say different things (Nate 10/10).
//
// The letter names ONE issue, the one that matters most to the person. Someone who follows many issues is not asked to
// write about all of them: they pick the one (helloFacts' default is the issue of a bill they took a stand on, else the
// first issue they follow), and the other issues get one short line. Their reason is optional. When it is blank the
// letter does not mention it, and it closes with a thank-you line, so no blank or placeholder ever reaches a legislator.
import { S, followedIssues, issuesOf, sessionInfo, spaced, nick, vary, townWord } from './core.js';
import { aWords, needsSelf } from './titles.js';

// The line the letter closes with when the person has written no sign-off of their own (Nate 10/10).
export const THANKS = 'Mahalo for your work for our district.';
// The thank-you line as this person's letters say it (R-259: one of a few, steady for them). "Our district" is true only of
// the writer's own lawmaker: a hello to anyone else (Kai to Sen. Kim, who does not represent him) thanks them without
// claiming a district they share (R-303, the walk of 10/17). own defaults to true: the walkthrough's hello goes to their own two.
export const thanksLine = (own = true) => own ? vary('hello|thanks', [THANKS, 'Mahalo for all you do for our district.', 'Thank you for your work for our community.'])
  : vary('hello|thanks', ['Mahalo for your work.', 'Mahalo for all you do.', 'Thank you for your public service.']);

export const sentence = s => { const t = String(s || '').replace(/\s+/g, ' ').trim(); return t && !/[.!?…"”)]$/.test(t) ? t + '.' : t; };
export const closingOf = c => { const t = String(c || '').replace(/\s+/g, ' ').trim(); return t && !/[,.!]$/.test(t) ? t + ',' : t; };
export const andList = xs => xs.length <= 1 ? xs.join('') : xs.length === 2 ? `${xs[0]} and ${xs[1]}` : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;

// "House District 22", or "Senate District 11 and House District 22": where they live, never the street (their address
// was never kept). Only the districts of the people the letter goes to: to is [{ leg }].
export function districtWords(to) {
  const ds = to.map(t => t.leg).filter(Boolean).sort((a, b) => a.chamber === 'S' ? -1 : b.chamber === 'S' ? 1 : 0).map(l => `${l.chamber === 'S' ? 'Senate' : 'House'} District ${l.district}`);
  return andList([...new Set(ds)]);
}
// ---------------- the words every letter shares (R-259) ----------------
// Nate 10/12: the letters were "extremely stiff" and used the app's words "rather than just what someone would say". So:
// the person says who they are first, then where they stand; contractions; no "I respectfully ask"; no Capitol words
// ("hold", "comments", "stay alive", "in conference") and no district numbers, only the town when they gave one. Each
// sentence has two or three wordings (vary, core.js), steady per person and bill. key: something steady for this letter,
// such as the bill number; never their name, which changes while they type.
export { vary, townWord };
// "My name is Leilani Kahale, and I’m a parent." titles: the "I'm a..." titles this letter uses.
export function whoLine(name, titles, key) {
  const n = String(name || '').trim(), t = aWords(titles || []);
  const who = n && t ? vary(key + '|who', [`My name is ${n}, and I’m ${t}.`, `I’m ${n}, ${t}.`, `My name is ${n}. I’m ${t}.`])
    : n ? vary(key + '|who', [`My name is ${n}.`, `I’m ${n}.`]) : t ? `I’m ${t}.` : '';
  // A faith leader, board member, nonprofit or public health worker says they are not speaking for their group (R-147).
  const self = t && needsSelf(titles) ? vary(key + '|self', ['I’m writing for myself, not for any group.', 'I’m speaking only for myself here.']) : '';
  return [who, self].filter(Boolean).join(' ');
}
// Where they stand, in one sentence. pos: HIPHI's position word when the letter carries it (strongly_support...), else the
// person's stance ('support' | 'oppose' | 'comments').
const STAND = {
  strongly_support: n => [`I strongly support ${n}.`, `I’m writing in strong support of ${n}.`],
  support: n => [`I support ${n}.`, `I’m writing in support of ${n}.`, `I’m writing to support ${n}.`],
  support_amend: n => [`I support ${n}, with a few changes.`, `I support ${n}, with some amendments.`],
  strongly_oppose: n => [`I strongly oppose ${n}.`, `I’m writing because I strongly oppose ${n}.`],
  oppose: n => [`I oppose ${n}.`, `I’m writing to oppose ${n}.`, `I’m against ${n}.`],
  comments: n => [`I’d like to share a few thoughts on ${n}.`, `I have a few thoughts on ${n}.`],
};
export const standLine = (pos, n, key) => vary(key + '|stand', (STAND[pos] || STAND.comments)(n));
// "I live in your district." to their own lawmaker, with the town when they gave one.
export function ownLine(key, many = false) {
  const town = townWord(), d = many ? 'districts' : 'district';
  return town ? vary(key + '|live', [`I live in ${town}, in your ${d}.`, `I’m one of your constituents in ${town}.`])
    : vary(key + '|live', [`I live in your ${d}.`, `I’m one of your constituents.`]);
}

// The subject for the hello. "your constituent" is only true for a person's own lawmaker; the town, never the district number (R-259).
export const helloSubject = (to, own) => { const town = townWord();
  return own ? vary('hello|subj', [`A question from your constituent${town ? ` in ${town}` : ''}`, `A question from a constituent${town ? ` in ${town}` : ''}`])
    : 'A question from a Hawaiʻi resident'; };

// A bill in the letter: "HB 1523 (Disposable e-cigarette ban)".
const billWords = b => nick(b) ? `${spaced(b.bill_number)} (${inSentence(nick(b))})` : spaced(b.bill_number);

// An issue name read inside a sentence ("The health issue I care about most is a fee on sugary drinks."): its first letter
// goes lower-case, because the names are written as chip labels (Nate 10/10, fresh-eyes review). A name whose first word is a
// proper noun, a place, a program or an acronym keeps its capital. KEEP_CAPS is the explicit list; an all-capitals first word
// (SNAP, FDA, WIC, DUI) is kept too, so a new acronym issue is never written "sNAP". The 91 issue names were checked against
// both (demo/snapshot.json, 10/10): only SNAP (3 names), FDA (1), "Farm to Families food program" and "Summer Streets
// car-free road pilot" begin with a name or acronym; every other name starts with an ordinary word.
const KEEP_CAPS = new Set(['Hawaiʻi', 'Kauaʻi', 'Maui', 'Oʻahu', 'Molokaʻi', 'Lānaʻi', 'Medicaid', 'Medicare',
  'Farm to Families food program', 'Summer Streets car-free road pilot']);
const inSentence = name => {
  const s = String(name || '').trim(), first = s.split(/\s+/)[0] || '';
  if (!s || KEEP_CAPS.has(first) || KEEP_CAPS.has(s) || /^[A-Z][A-Z0-9]+$/.test(first)) return s;
  return s[0].toLowerCase() + s.slice(1);
};

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
  const n = String(name || '').trim(), top = facts.top ? facts.top.name : '', k = 'hello';
  const greet = to.length ? `Aloha ${andList(to.map(t => t.greet))},` : 'Aloha,';
  // R-259: who they are, then the town (never a district number: nobody says "I live in House District 22").
  const who = [whoLine(n, titles, k), own ? ownLine(k, to.length > 1) : ''].filter(Boolean).join(' ');
  const bw = facts.bill ? billWords(facts.bill) : '';
  const bill = !bw ? '' : facts.billSupport ? vary(k + '|bill', [`${bw} would help, and I support it.`, `I support ${bw}, which would help.`])
    : vary(k + '|bill', [`I oppose ${bw}.`, `I’m against ${bw}.`]);
  // With nothing followed the letter makes no claim about bills it has not followed (Nate 10/10): it only says the person cares.
  const focus = top ? `${vary(k + '|focus', [`The health issue I care about most is ${inSentence(top)}.`, `The health issue that matters most to me is ${inSentence(top)}.`, `What I care about most right now is ${inSentence(top)}.`])} ${bill}`.trim()
    : vary(k + '|focus', ['I care about the health of our community.', 'The health of our community matters a lot to me.']);
  const off = facts.off ? ' before the session opens in January' : '';
  const ask = top ? vary(k + '|ask', [`Where do you stand on it? I’d be grateful to hear back${off}.`, `How do you see it? I’d love to hear back${off}.`])
    : vary(k + '|ask', [`What health issues are you working on${facts.off ? ' for the next session' : ' this session'}? I’d be grateful to hear back.`,
      `Which health issues are you focused on${facts.off ? ' for the next session' : ' this session'}? I’d love to hear back.`]);
  // "I also follow" sits above the question, so the letter ends on its ask and the sign-off (the other issues are context for the
  // one it names, not a second request).
  const others = facts.others.length ? vary(k + '|others', [`I also follow ${andList(facts.others.map(inSentence))}.`, `I’m also keeping an eye on ${andList(facts.others.map(inSentence))}.`]) : '';
  const sign = closingOf(closing) || thanksLine(own);
  return [greet, who, focus, others, sentence(reason), ask, [sign, n].filter(Boolean).join('\n')].filter(Boolean).join('\n\n');
}
