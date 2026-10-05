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
  { k: 'kupuna', label: 'kupuna (older adult)', say: 'kupuna', first: true, group: 'family', topics: ['care', 'family', 'food', 'around'], words: /(kupuna|kūpuna|older adult|senior|elder|aging|medicare|caregiver|long-term care|pedestrian|crosswalk)/i },
  { k: 'student', label: 'student', say: 'student', first: true, group: 'school', pick: ['student-hs', 'student-college'], topics: [], words: null },
  { k: 'student-hs', label: 'high school student', say: 'high school student', group: 'school', topics: ['food', 'tobacco', 'around', 'climate'], words: /\b(school|student|youth|teens?|vap|e-cig|nicotine|flavor|bus|heat)/i },
  { k: 'student-college', label: 'college student', say: 'college student', group: 'school', topics: ['food', 'family', 'care', 'around', 'climate'], words: /\b(student|college|universit|tuition|snap|rent|bus|transit|tax credit for training)/i },
  { k: 'teacher', label: 'teacher (kumu)', say: 'teacher', first: true, group: 'school', topics: ['food', 'tobacco', 'around', 'climate'], words: /\b(school|student|classroom|keiki|kids?|child(ren)?|youth|teach|heat)/i },
  { k: 'nurse', label: 'nurse', say: 'nurse', first: true, group: 'health', topics: ['care', 'tobacco', 'food', 'climate', 'around'], words: /(health|nurs|vaccin|medical|hospital|clinic|vap|tobacco|nicotine|sugary|alcohol|abortion|preventive)/i },
  { k: 'doctor', label: 'doctor', say: 'doctor', first: true, group: 'health', topics: ['care', 'tobacco', 'food', 'climate', 'around'], words: /(health|physician|doctor|vaccin|medical|hospital|clinic|vap|tobacco|nicotine|sugary|alcohol|abortion|preventive)/i },
  { k: 'business', label: 'small business owner', say: 'small business owner', first: true, group: 'work', topics: ['family', 'tobacco', 'food'], words: /\b(business|wage|tax|retail|sales|store|leave|employ|license)/i },
  { k: 'volunteer', label: 'community volunteer', say: 'community volunteer', first: true, group: 'community', topics: [], words: /\b(volunteer|nonprofit|community)/i },
  { k: 'grandparent', label: 'grandparent', say: 'grandparent', group: 'family', topics: ['food', 'tobacco', 'around', 'family', 'care'], words: /\b(school|keiki|kids?|child(ren)?|youth|teens?|grand|famil(y|ies))/i },
  { k: 'caregiver', label: 'family caregiver (for an older or disabled relative)', say: 'family caregiver', group: 'family', topics: ['family', 'care'], words: /(caregiver|kupuna|kūpuna|disab|long-term|leave|elder|older|medical)/i },
  { k: 'renter', label: 'renter', say: 'renter', group: 'family', topics: ['family'], words: /\b(rent|renter|housing|homes?|landlord|evict)/i },
  { k: 'dental', label: 'dentist or dental worker', say: 'dental professional', group: 'health', topics: ['care', 'food'], words: /(dental|dentist|hygien|oral|teeth|tooth|filling|sugary|fluorid)/i },
  { k: 'health-worker', label: 'health care worker (pharmacy, community health, other)', say: 'health care worker', group: 'health', topics: ['care', 'tobacco', 'food'], words: /(health|medical|pharm|vaccin|hospital|clinic|community health|medicaid)/i },
  { k: 'public-health', label: 'public health worker', say: 'public health worker', group: 'health', self: true, topics: ['food', 'tobacco', 'care', 'family', 'around', 'climate'], words: /(public health|prevent|tobacco|vap|sugary|nutrition|snap|injur|pedestrian|vaccin|pesticid)/i },
  { k: 'social-worker', label: 'social worker or counselor', say: 'social worker or counselor', group: 'health', topics: ['family', 'care', 'tobacco'], words: /(mental|neglect|poverty|famil|child|substance|youth|counsel|homeless|prison)/i },
  { k: 'first-responder', label: 'first responder (fire, police, EMS)', say: 'first responder', group: 'health', topics: ['around', 'tobacco', 'climate'], words: /(traffic|crash|driv|dui|pedestrian|crosswalk|speed|camera|wildfire|fire|emergenc|alcohol)/i },
  { k: 'school-staff', label: 'school staff member (aide, counselor, food service)', say: 'school staff member', group: 'school', topics: ['food', 'tobacco', 'climate', 'around'], words: /\b(school|student|meals?|lunch|classroom|heat|keiki)/i },
  { k: 'coach', label: 'coach or youth leader', say: 'coach or youth leader', group: 'school', topics: ['tobacco', 'food', 'around'], words: /\b(youth|keiki|kids?|vap|sport|activ|school|summer|teen)/i },
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
export const tidyOwn = s => String(s || '').replace(/[<>\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim().slice(0, OWN_MAX);
export const ownKey = s => { const w = tidyOwn(s); return w ? 'own:' + w : ''; };
export const titleOf = k => BY.get(k) || null;
// The chip's words; a person's own title is their words exactly.
export const titleLabel = t => isOwn(t) ? ownWords(t) : (BY.get(t)?.label || '');
// What a letter says: "teacher", or their own words as typed (a person who typed "UH professor" keeps the capitals).
export const titleSay = t => isOwn(t) ? ownWords(t) : (BY.get(t)?.say || '');
// Keys only from the list (an old key that left the list is dropped, never shown as a blank chip).
export const cleanTitles = arr => { const seen = new Set(), out = [];
  for (const t of Array.isArray(arr) ? arr : []) { const v = isOwn(t) ? ownKey(ownWords(t)) : BY.has(t) && !BY.get(t).pick ? t : '';
    if (v && !seen.has(v.toLowerCase())) { seen.add(v.toLowerCase()); out.push(v); } }
  return out.slice(0, TITLES_MAX); };
// "a" or "an" before the first title.
// An abbreviation goes by its first letter's sound ("an EMT", "a UH professor"); a word by its first letter ("an aide").
const article = w => { const first = String(w).split(/\s+/)[0];
  if (/^[A-Z]{2,}$/.test(first)) return /^[AEFHILMNORSX]/.test(first) ? 'an' : 'a';
  return /^[aeiou]/i.test(w) && !/^(uni|use|one|eu)/i.test(w) ? 'an' : 'a'; };

// The two titles that fit a bill best. A title scores 3 when its words appear in what the bill is about (its everyday
// name, summary, title and issue names), 2 when the bill's category is one of its topics; a title of their own scores 3
// when one of its longer words appears there. Ties keep the person's own order, and the two keep that order in the
// letter. Nothing fits: their first two. o: { cats: ['food'], text: 'Free school meals for every student ...' }.
const STOP = new Set(['with', 'from', 'that', 'this', 'their', 'about', 'other', 'person', 'people', 'member', 'worker', 'leader', 'owner']);
export function fitScore(t, { cats = [], text = '' } = {}) {
  if (isOwn(t)) return ownWords(t).toLowerCase().split(/[^a-zʻāēīōū]+/i).some(w => w.length >= 4 && !STOP.has(w) && text.toLowerCase().includes(w)) ? 3 : 0;
  const d = BY.get(t); if (!d) return 0;
  return (d.words && d.words.test(text) ? 3 : 0) + (d.topics.some(c => cats.includes(c)) ? 2 : 0);
}
export function pickTwo(titles, about = {}) {
  const list = cleanTitles(titles); if (list.length <= 2) return list;
  const scored = list.map((t, i) => ({ t, i, s: fitScore(t, about) }));
  const best = scored.slice().sort((a, b) => b.s - a.s || a.i - b.i).slice(0, 2);
  return best.sort((a, b) => a.i - b.i).map(x => x.t);
}
// Does a letter with these titles add "writing for myself"?
export const needsSelf = two => two.some(t => BY.get(t)?.self);
// "As a parent and teacher" / "As a faith leader, writing for myself" / '' when there are none.
export function asWords(two) {
  const says = two.map(titleSay).filter(Boolean); if (!says.length) return '';
  return `As ${article(says[0])} ${says.join(' and ')}${needsSelf(two) ? ', writing for myself' : ''}`;
}
// "a parent and teacher" for a sentence that already has its subject ("My name is Leilani, a parent and teacher, and ...").
export function aWords(two) { const says = two.map(titleSay).filter(Boolean); return says.length ? `${article(says[0])} ${says.join(' and ')}` : ''; }
// A letter's opening sentence with the titles in front: "As a parent and teacher, I support HB 1523."
// "I" stays a capital; any other first word is lowered ("As a nurse, the committee..." never happens, but "My" would).
export const withTitles = (two, sentence) => { const a = asWords(two); if (!a) return sentence;
  return `${a}, ${/^I\b/.test(sentence) ? sentence : sentence.charAt(0).toLowerCase() + sentence.slice(1)}`; };
// The list a typed word finds: titles whose words start with it, the first eight first. Student finds both kinds.
export function findTitles(q, have = []) {
  const s = String(q || '').trim().toLowerCase(); if (!s) return [];
  const words = t => t.label.toLowerCase().split(/[^a-zʻāēīōū]+/i);
  return TITLES.filter(t => !t.pick && !have.includes(t.k) && (t.label.toLowerCase().startsWith(s) || words(t).some(w => w.startsWith(s))))
    .sort((a, b) => (b.first ? 1 : 0) - (a.first ? 1 : 0)).slice(0, 6);
}
export const FIRST = TITLES.filter(t => t.first);
// The two kinds of student are reached through "student" (shown first), so "More titles" does not list them again (A-14).
export const inGroup = g => TITLES.filter(t => t.group === g && !t.first && !t.pick && !/^student-/.test(t.k));
