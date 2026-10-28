// "I'm a..." (R-147, Nate 10/4): the titles a person picks for themselves, and the two that open each letter.
// Pure data and pure functions, no imports, so the public walkthrough, the profile page and Staff v2 all read the same
// list (Staff v2 imports it as ../pub/titles.js). The list was researched 10/4 and agreed by Nate ("Yes to the list and
// both recommendations"): lawmakers weigh a constituent's own reasons and a role that relates to the bill most (CMF
// 2011 and 2017, CDC PCD 2017, de Beaumont), and Hawaiʻi's testimony guides open with who you are (Public Access Room,
// ACLU of Hawaiʻi). The plan and its sources: https://claude.ai/artifact/FSzXqzhDcJggJtbhkoNX1d (REQUESTS R-147).
//
// A title is stored as its key ('parent', 'student-hs') or, for a person's own words, 'own:' + the words (backend 125,
// people.titles; on the device, hiphi_me.titles). Every title reads in the letter's first line, "As a ___, I support
// HB 1523.", so `say` is a plain noun. Nothing on health, race, religion beyond "faith leader", immigration or benefits
// is offered: people may type those themselves (the letter is public; the step says so).
//   label   the words on the chip and in lists
//   say     the words in a letter ("As a teacher")
//   group   where it sits behind "More titles"; first: one of the eight shown first
//   topics  HIPHI's categories it speaks to (docs/issues_2026.json: food, tobacco, care, family, around, climate)
//   words   words in a bill's name, summary or issue that make it fit that bill best
//   self    a role that could sound like speaking for a group: the letter adds "writing for myself" (the Public Access Room:
//           name a group only when you are authorized to speak for it; Nate said no to speaking for a group)
export const TITLES = [
  { k: 'parent', label: 'parent', say: 'parent', first: true, group: 'family', topics: ['food', 'tobacco', 'around', 'family', 'care'], words: /\b(school|keiki|kids?|child(ren)?|youth|teens?|bab(y|ies)|famil(y|ies)|parent|minor)/i },
  { k: 'kupuna', label: 'kupuna', say: 'kupuna', first: true, group: 'family', topics: ['care', 'family', 'food', 'around'], words: /(kupuna|kūpuna|older adult|senior|elder|aging|medicare|caregiver|long-term care|pedestrian|crosswalk)/i },
  { k: 'student', label: 'student', say: 'student', group: 'school', pick: ['student-hs', 'student-college'], topics: [], words: null },
  { k: 'student-hs', label: 'high school student', say: 'high school student', first: true, group: 'school', topics: ['food', 'tobacco', 'around', 'climate'], words: /\b(school|student|youth|teens?|e-cig|electronic smoking|nicotine|flavor|bus|heat)/i },
  { k: 'student-college', label: 'college student', say: 'college student', first: true, group: 'school', topics: ['food', 'family', 'care', 'around', 'climate'], words: /\b(student|college|universit|tuition|snap|rent|bus|transit|tax credit for training)/i },
  { k: 'teacher', label: 'teacher (kumu)', say: 'teacher', first: true, group: 'school', topics: ['food', 'tobacco', 'around', 'climate'], words: /\b(school|student|classroom|keiki|kids?|child(ren)?|youth|teach|heat)/i },
  { k: 'nurse', label: 'nurse', say: 'nurse', also: ['rn', 'registered nurse', 'lpn', 'licensed practical nurse'], first: true, group: 'health', topics: ['care', 'tobacco', 'food', 'climate', 'around'], words: /(health|nurs|vaccin|medical|hospital|clinic|e-cig|electronic smoking|tobacco|nicotine|sugary|alcohol|abortion|preventive)/i },
  { k: 'doctor', label: 'doctor', say: 'doctor', also: ['physician', 'md', 'm.d.', 'pediatrician', 'family doctor'], first: true, group: 'health', topics: ['care', 'tobacco', 'food', 'climate', 'around'], words: /(health|physician|doctor|vaccin|medical|hospital|clinic|e-cig|electronic smoking|tobacco|nicotine|sugary|alcohol|abortion|preventive)/i },
  { k: 'business', label: 'small business owner', say: 'small business owner', first: true, group: 'work', topics: ['family', 'tobacco', 'food'], words: /\b(business|wage|tax|retail|sales|store|leave|employ|license)/i },
  { k: 'volunteer', label: 'community volunteer', say: 'community volunteer', first: true, group: 'community', topics: [], words: /\b(volunteer|nonprofit|community)/i },
  { k: 'grandparent', label: 'grandparent', say: 'grandparent', group: 'family', topics: ['food', 'tobacco', 'around', 'family', 'care'], words: /\b(school|keiki|kids?|child(ren)?|youth|teens?|grand|famil(y|ies))/i },
  { k: 'caregiver', label: 'family caregiver (for an older or disabled relative)', say: 'family caregiver', group: 'family', topics: ['family', 'care'], words: /(caregiver|kupuna|kūpuna|disab|long-term|leave|elder|older|medical)/i },
  { k: 'renter', label: 'renter', say: 'renter', group: 'family', topics: ['family'], words: /\b(rent|renter|housing|homes?|landlord|evict)/i },
  { k: 'dental', label: 'dentist or dental worker', say: 'dental professional', also: ['dentist', 'dental hygienist'], group: 'health', topics: ['care', 'food'], words: /(dental|dentist|hygien|oral|teeth|tooth|filling|sugary|fluorid)/i },
  // R-212 #23 (the Clinician Voice): the titles a clinician looked for and could not find. A license's letters find its
  // title ("NP", "APRN", "PA"); the letter says the words, which every reader knows.
  { k: 'np', label: 'nurse practitioner (NP, APRN)', say: 'nurse practitioner', also: ['np', 'aprn', 'advanced practice registered nurse'], group: 'health', topics: ['care', 'tobacco', 'food', 'family'], words: /(health|nurs|vaccin|medical|clinic|primary care|e-cig|electronic smoking|tobacco|nicotine|sugary|preventi|medicaid)/i },
  { k: 'pa', label: 'physician assistant (PA)', say: 'physician assistant', also: ['pa', 'pa-c'], group: 'health', topics: ['care', 'tobacco', 'food'], words: /(health|medical|clinic|hospital|vaccin|e-cig|electronic smoking|tobacco|nicotine|medicaid)/i },
  { k: 'pharmacist', label: 'pharmacist', say: 'pharmacist', also: ['pharmd', 'pharm.d.'], group: 'health', topics: ['care', 'tobacco'], words: /(pharm|drug|prescri|medication|vaccin|nicotine|tobacco|e-cig|electronic smoking|cessation|naloxone)/i },
  { k: 'dietitian', label: 'dietitian or nutritionist', say: 'dietitian', also: ['rd', 'rdn', 'nutritionist', 'registered dietitian'], group: 'health', topics: ['food', 'care'], words: /(nutritio|diet|food|meal|lunch|sugary|beverage|snap|wic|diabetes|obesity|produce)/i },
  { k: 'health-worker', label: 'health care worker (community health, medical assistant, other)', say: 'health care worker', group: 'health', topics: ['care', 'tobacco', 'food'], words: /(health|medical|pharm|vaccin|hospital|clinic|community health|medicaid)/i },
  { k: 'public-health', label: 'public health worker', say: 'public health worker', group: 'health', self: true, topics: ['food', 'tobacco', 'care', 'family', 'around', 'climate'], words: /(public health|prevent|tobacco|e-cig|electronic smoking|sugary|nutrition|snap|injur|pedestrian|vaccin|pesticid)/i },
  { k: 'social-worker', label: 'social worker or counselor', say: 'social worker or counselor', group: 'health', topics: ['family', 'care', 'tobacco'], words: /(mental|neglect|poverty|famil|child|substance|youth|counsel|homeless|prison)/i },
  { k: 'first-responder', label: 'first responder (fire, police, EMS)', say: 'first responder', group: 'health', topics: ['around', 'tobacco', 'climate'], words: /(traffic|crash|driv|dui|pedestrian|crosswalk|speed|camera|wildfire|fire|emergenc|alcohol)/i },
  { k: 'school-staff', label: 'school staff member (aide, counselor, food service)', say: 'school staff member', group: 'school', topics: ['food', 'tobacco', 'climate', 'around'], words: /\b(school|student|meals?|lunch|classroom|heat|keiki)/i },
  { k: 'coach', label: 'coach or youth leader', say: 'coach or youth leader', group: 'school', topics: ['tobacco', 'food', 'around'], words: /\b(youth|keiki|kids?|e-cig|sport|activ|school|summer|teen)/i },
  { k: 'farmer', label: 'farmer or food grower (mahiʻai)', say: 'farmer', group: 'work', topics: ['food', 'climate'], words: /(farm|local food|agricultur|pesticid|grow|snap match|water|invasive|food hub)/i },
  { k: 'fisher', label: 'fisher (lawaiʻa)', say: 'fisher', group: 'work', topics: ['climate', 'food'], words: /(fish|ocean|reef|water|cesspool|coast|invasive)/i },
  { k: 'food-worker', label: 'restaurant or food worker', say: 'restaurant or food worker', group: 'work', topics: ['food', 'family', 'tobacco'], words: /(restaurant|food|wage|alcohol|liquor|sugary|beverage|tip)/i },
  { k: 'nonprofit', label: 'nonprofit worker', say: 'nonprofit worker', group: 'work', self: true, topics: ['family'], words: /(nonprofit|community organization|grant)/i },
  { k: 'faith', label: 'faith leader', say: 'faith leader', group: 'community', self: true, topics: ['family', 'care'], words: /(poverty|famil|hunger|food|housing|homeless)/i },
  { k: 'board', label: 'neighborhood board member', say: 'neighborhood board member', group: 'community', self: true, topics: ['around', 'climate'], words: /(neighborhood|street|traffic|crosswalk|speed|park|county)/i },
  { k: 'organizer', label: 'community organizer', say: 'community organizer', group: 'community', topics: [], words: /\b(community|organiz)/i },
  { k: 'bus-rider', label: 'bus rider', say: 'bus rider', group: 'community', topics: ['around'], words: /\b(bus|transit|fare|rides?)\b/i },
  { k: 'walker', label: 'person who walks or bikes to get around', say: 'person who walks or bikes to get around', group: 'community', topics: ['around'], words: /(walk|pedestrian|bik|crosswalk|crossing|bicycl|street|sidewalk|routes? to school|car-free)/i },
];
// "More titles", in this order (the agreed list's groups).
export const GROUPS = [['family', 'Family and home'], ['health', 'Health'], ['school', 'School and youth'], ['work', 'Work'], ['community', 'Community and getting around']];
export const OWN_MAX = 40, TITLES_MAX = 10;
const BY = new Map(TITLES.map(t => [t.k, t]));

export const isOwn = t => typeof t === 'string' && t.startsWith('own:');
export const ownWords = t => isOwn(t) ? t.slice(4) : '';
// Their words go into a sentence ("As a nurse, I support ..."), so the tidy-up keeps that sentence clean (R-212 #10, the
// walk): a comma or colon they ended with would print "nurse,, I support", and "a nurse" would print "As a a nurse". A
// full stop stays only after an initial ("R.N."). Too long for the 40 the database keeps (migration 125): cut at the last
// whole word, never mid-word; the box says so before it happens (titlepick.js ownNote).
const prepOwn = s => String(s || '').replace(/[<>\u0000-\u001f]/g, '').replace(/\s+/g, ' ').replace(/\s*([,;:])[\s,;:]*/g, '$1 ').trim()
  .replace(/^(?:(?:i['’]?m|i am|as)\s+)?(?:an?|the)\s+(?=\S)/i, '');
export const tidyOwn = s => { let w = prepOwn(s);
  if (w.length > OWN_MAX) { const cut = w.slice(0, OWN_MAX + 1); w = cut.includes(' ') ? cut.slice(0, cut.lastIndexOf(' ')) : w.slice(0, OWN_MAX); }
  return w.replace(/[\s,;:\-–—&/]+$/, '').replace(/(?<!\b\p{L})\.+$/u, '').replace(/\s+(?:and|or|of|for|with|in|at|to)$/i, '').trim(); };
// Over the 40 a title keeps: how many letters and spaces to take out to keep it all, so the box can say it (0 when it fits).
export const ownOver = s => Math.max(0, prepOwn(s).length - OWN_MAX);
export const ownKey = s => { const w = tidyOwn(s); return w ? 'own:' + w : ''; };
export const titleOf = k => BY.get(k) || null;
// The chip's words; a person's own title is their words exactly.
export const titleLabel = t => isOwn(t) ? ownWords(t) : (BY.get(t)?.label || '');
// What a letter says: "teacher", or their own words as typed (a person who typed "UH professor" keeps the capitals).
export const titleSay = t => isOwn(t) ? ownWords(t) : (BY.get(t)?.say || '');
// Own words that are a list title ("teacher", "Kupuna", "teacher (kumu)") are that title, so staff's "They are" filter and
// the bill fit find them (the review, 10/5). The bare "student" stays their words: it could be either kind.
const SAID = new Map();
for (const t of TITLES) if (!t.pick) for (const w of [t.say, t.label, t.label.replace(/\s*\(.*\)\s*$/, ''), ...(t.also || [])]) SAID.set(w.toLowerCase(), t.k);
export const listKeyFor = words => SAID.get(String(words || '').replace(/\s+/g, ' ').trim().toLowerCase()) || '';
// Keys only from the list (an old key that left the list is dropped, never shown as a blank chip).
export const cleanTitles = arr => { const seen = new Set(), out = [];
  for (const t of Array.isArray(arr) ? arr : []) { const v = isOwn(t) ? (listKeyFor(ownWords(t)) || ownKey(ownWords(t))) : BY.has(t) && !BY.get(t).pick ? t : '';
    if (v && !seen.has(v.toLowerCase())) { seen.add(v.toLowerCase()); out.push(v); } }
  return out.slice(0, TITLES_MAX); };
// "a" or "an" before the first title.
// An abbreviation goes by its first letter's sound ("an EMT", "a UH professor"); a word by its first letter ("an aide").
const article = w => { const first = String(w).split(/\s+/)[0].replace(/\./g, ''); // "R.N." is "an RN"
  if (/^[A-Z]{2,}$/.test(first)) return /^[AEFHILMNORSX]/.test(first) ? 'an' : 'a';
  return /^[aeiou]/i.test(w) && !/^(uni|use|one|eu)/i.test(w) ? 'an' : 'a'; };

// The title a letter uses by default (R-165, Nate 10/5: "The app should default to one"; it was two since 10/4): the one
// that fits the bill best. A title scores 3 when its words appear in what the bill is about (its everyday name, summary,
// title and issue names), 2 when the bill's category is one of its topics; a title of their own scores 3 when one of its
// longer words appears there; their order breaks ties, so nothing fitting means their first title. In the letter they can
// tap to use more, as many as they like. o: { cats: ['food'], text: 'Free school meals for every student ...' }.
const STOP = new Set(['with', 'from', 'that', 'this', 'their', 'about', 'other', 'person', 'people', 'member', 'worker', 'leader', 'owner']);
export function fitScore(t, { cats = [], text = '' } = {}) {
  if (isOwn(t)) return ownWords(t).toLowerCase().split(/[^a-zʻāēīōū]+/i).some(w => w.length >= 4 && !STOP.has(w) && text.toLowerCase().includes(w)) ? 3 : 0;
  const d = BY.get(t); if (!d) return 0;
  return (d.words && d.words.test(text) ? 3 : 0) + (d.topics.some(c => cats.includes(c)) ? 2 : 0);
}
export function pickTitle(titles, about = {}) {
  const list = cleanTitles(titles); if (!list.length) return [];
  return [list.map((t, i) => ({ t, i, s: fitScore(t, about) })).sort((a, b) => b.s - a.s || a.i - b.i)[0].t];
}
// Does a letter with these titles add "writing for myself"? The four group titles do unless the person turned it off, and any
// title does when they turned it on (R-212 #23: a nurse at a hospital may not want to sound like the hospital). The choice is
// the person's, on this device, for every letter: 'hiphi_self' is '1' (on) or '0' (off); unset follows the titles.
export const SELF_KEY = 'hiphi_self';
export const selfPref = () => { try { const v = globalThis.localStorage?.getItem(SELF_KEY); return v === '1' ? true : v === '0' ? false : null; } catch { return null; } };
export const setSelfPref = on => { try { globalThis.localStorage?.setItem(SELF_KEY, on ? '1' : '0'); } catch { /* this visit only */ } };
export const needsSelf = (two, pref = selfPref()) => two.length > 0 && (pref ?? two.some(t => BY.get(t)?.self));
// "parent", "parent and teacher", "parent, teacher and coach" (any number since R-165).
const listOf = xs => xs.length <= 2 ? xs.join(' and ') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;
// "As a parent and teacher" / "As a faith leader, writing for myself" / '' when there are none.
export function asWords(two, self = needsSelf(two)) {
  const says = two.map(titleSay).filter(Boolean); if (!says.length) return '';
  return `As ${article(says[0])} ${listOf(says)}${self ? ', writing for myself' : ''}`;
}
// "a parent and teacher" for a sentence that already has its subject ("My name is Leilani, a parent and teacher, and ...").
export function aWords(two) { const says = two.map(titleSay).filter(Boolean); return says.length ? `${article(says[0])} ${listOf(says)}` : ''; }
// A letter's opening sentence with the titles in front: "As a parent and teacher, I support HB 1523."
// "I" stays a capital; any other first word is lowered ("As a nurse, the committee..." never happens, but "My" would).
export const withTitles = (two, sentence) => { const a = asWords(two); if (!a) return sentence;
  return `${a}, ${/^I\b/.test(sentence) ? sentence : sentence.charAt(0).toLowerCase() + sentence.slice(1)}`; };
// The list a typed word finds: titles whose words start with it, the ones shown first first. Student finds both kinds.
export function findTitles(q, have = []) {
  const s = String(q || '').trim().toLowerCase(); if (!s) return [];
  const words = t => t.label.toLowerCase().split(/[^a-zʻāēīōū]+/i);
  return TITLES.filter(t => !t.pick && !have.includes(t.k) && (t.label.toLowerCase().startsWith(s) || words(t).some(w => w.startsWith(s)) || (t.also || []).some(a => a.startsWith(s))))
    .sort((a, b) => (b.first ? 1 : 0) - (a.first ? 1 : 0)).slice(0, 6);
}
export const FIRST = TITLES.filter(t => t.first);
// The six chips Your voice shows first (R-304, Nate 28 Oct: "fewer shown first, about 6", suggested "from the issues
// followed"). Each title is scored with the fitScore a letter uses, summed over the issues the person follows, so the chips
// are the ones their letters would open with; a tie goes to today's first titles, then to the list's order. Titles they
// already chose always show, first, so nothing they picked hides behind "More titles".
// about: [{ cats, text }], one per followed issue (none: today's first titles, in order).
export function suggestTitles(about = [], chosen = [], n = 6) {
  const have = cleanTitles(chosen), on = new Set(have);
  const ranked = TITLES.filter(t => !t.pick && !on.has(t.k)).map((t, i) => ({ k: t.k, i, f: t.first ? 1 : 0, s: about.reduce((sum, a) => sum + fitScore(t.k, a), 0) }))
    .sort((a, b) => b.s - a.s || b.f - a.f || a.i - b.i).map(x => x.k);
  return [...have, ...ranked].slice(0, Math.max(n, have.length));
}
// Every title in a group, the first ones too (R-304: with six suggested chips, "More titles" holds all the rest).
export const allInGroup = g => TITLES.filter(t => t.group === g && !t.pick);
// The two kinds of student are shown first as plain titles (R-165: the "student" choice that opened two more was clunky),
// so "More titles" does not list them again (A-14).
export const inGroup = g => TITLES.filter(t => t.group === g && !t.first && !t.pick && !/^student-/.test(t.k));
