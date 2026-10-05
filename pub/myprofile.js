// The person's profile, read and saved in one place (R-147): the walkthrough (pub/helper.js), the profile page
// (pub/profile.js) and More all use it. Nate 10/4: a profile only with a mobile number or an email.
//   on this device  hiphi_me: name, titles, story, quote, capitolAcct (the walkthrough's own store since 9/19)
//   on the account  people (backend 125, save_my_profile_v2 / my_profile_v2): name, titles, story, interests, districts;
//                   loaded at sign-in by kernel.js loadUser into S.profile
// With an email (signed in) the account is the truth and every save goes to both. With only a number the profile stays
// on this phone until texts are set up and a code by text can bring it to another (R-146). Without either, nothing here
// is called a profile, though the walkthrough still remembers a name and titles on this device for the next letter.
import { S, DEMO, supa, textSaved, wiz, wizSet, PROFILE_KEYS } from './core.js';
import { cleanTitles } from './titles.js';

const ME_KEY = 'hiphi_me';
export const loadMe = () => { try { return JSON.parse(localStorage.getItem(ME_KEY) || '{}') || {}; } catch { return {}; } };
const saveMe = patch => { try { localStorage.setItem(ME_KEY, JSON.stringify({ ...loadMe(), ...patch })); } catch { /* private mode */ } };
// A count of its kind only (visitlog.js, backend 130); loaded when needed so this file stays light.
const count = kind => { import('./visitlog.js').then(m => m.logAct(kind)).catch(() => {}); };

export const signedIn = () => !!(S.session && S.user);
// Nate 10/4: "only work with an email or phone number".
export const hasProfile = () => signedIn() || !!textSaved();
// One name everywhere (R-156, the review: it came from five places that could disagree). Signed in, the account's; else
// the one saved on this device, even when it was cleared on purpose; the first visit's only until a name is saved.
// kernel.js keeps the device, the first visit and the account in step at sign-in; saveProfile below keeps them in step after.
export const myName = () => {
  if (signedIn() && S.profile?.name) return String(S.profile.name).trim();
  const me = loadMe(); if (typeof me.name === 'string') return me.name.trim();
  return String((S.user?.prefs || {}).name || wiz().name || '').trim();
};
export const myTitles = () => cleanTitles(signedIn() && Array.isArray(S.profile?.titles) ? S.profile.titles : loadMe().titles);
// The story for any issue (people.story), and the stories kept per issue topic (R-156 B3, backend 130: people.stories,
// { tobacco: '...', around: '...' }). A letter fills in the story for its bill's topic, else the any-issue one; a story
// about another topic is offered, never filled in (so a vaping story never opens a crosswalk letter).
export const myStory = () => String((signedIn() ? S.profile?.story : '') || (signedIn() && S.profile ? '' : loadMe().story) || '').trim();
export const myStories = () => { const s = signedIn() && S.profile ? S.profile.stories : loadMe().stories;
  return Object.fromEntries(Object.entries(s && typeof s === 'object' ? s : {}).filter(([, v]) => typeof v === 'string' && v.trim()).map(([k, v]) => [k, v.trim()])); };
export function storyFor(cats = []) {
  const st = myStories(), k = cats.find(c => st[c]);
  if (k) return { text: st[k], topic: k };
  const any = myStory(); return any ? { text: any, topic: '' } : null;
}
export function otherStory(cats = []) { const st = myStories(), k = Object.keys(st).find(c => !cats.includes(c)); return k ? { text: st[k], topic: k } : null; }
// One guiding question per topic for a story (R-156 B3): a moment from their own life, not an argument (Marshall Ganz's
// "story of self"; asking people to reflect on their own experience is what moved turnout in Hahrie Han's studies).
export const STORY_ASK = {
  '': 'What changed for you or your family?',
  food: 'Has the cost of food, or what’s in it, changed what your family eats?',
  tobacco: 'Have vaping, smoking or drinking touched you or someone close to you?',
  care: 'Has getting care, or paying for it, been hard for you or your family?',
  family: 'Have rent, wages or time off changed what your family can do?',
  around: 'Is there a street, a crossing or a bus ride that worries you?',
  climate: 'Have heat, fire, water or pesticides touched your home, work or health?',
};
export const storyAsk = topic => STORY_ASK[topic] || STORY_ASK[''];
// "HIPHI may quote me" in three choices (R-156 C3, after The Arc and Families USA): '' no; 'first' first name and island;
// 'name' full name; 'media' full name, and HIPHI may share it with reporters. Kept as interests: 'quote' for any yes (so
// staff's "May be quoted" filter still works), plus 'quote-name' or 'quote-media'. R-147's single tick reads as 'first',
// the narrowest. HIPHI asks again before any public use (the page says so).
export const QUOTE = [['first', 'My first name and island'], ['name', 'My full name'], ['media', 'My full name, and HIPHI may share it with reporters']];
export const quoteFrom = ints => !(ints || []).includes('quote') ? '' : ints.includes('quote-media') ? 'media' : ints.includes('quote-name') ? 'name' : 'first';
const quoteKeys = q => !q ? [] : q === 'media' ? ['quote', 'quote-media'] : q === 'name' ? ['quote', 'quote-name'] : ['quote'];
const QK = /^quote(-|$)/;
export const quoteLevel = () => {
  if (signedIn()) return quoteFrom(S.profile?.interests || []);
  const q = loadMe().quote; return q === true ? 'first' : ['first', 'name', 'media'].includes(q) ? q : '';
};
export const quoteOk = () => !!quoteLevel();
// How they'd help (testify in person, host, volunteer); "quote" is asked beside the story instead.
export const myInterests = () => (signedIn() ? S.profile?.interests || [] : loadMe().interests || []).filter(k => !QK.test(k) && k !== 'story');
// "LK" for Leilani Kahale; "IK" for ʻIlima Kahale (the ʻokina is a letter to Unicode, never an initial); "L" for one
// name; '' when there is none (the caller draws a person icon). pub/app.js whoAmI has the same rule (first wave).
export function initials(name = myName()) {
  const w = String(name || '').normalize('NFC').replace(/[ʻʼ‘’'`-]/g, '').replace(/[^\p{L}\p{M}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean);
  const first = x => (x.match(/\p{L}\p{M}*/u) || [''])[0];
  return w.length ? (first(w[0]) + (w.length > 1 ? first(w[w.length - 1]) : '')).toUpperCase() : '';
}

// Save part of the profile: { name, titles, story, stories, quote, interests, house, senate }. Only the keys given
// change. The device always keeps a copy; the account (signed in, not the sandbox) gets the same through
// save_my_profile_v2. quote is '' | 'first' | 'name' | 'media' (true reads as 'first'). Throws the account's error.
export async function saveProfile(patch) {
  const dev = {}, was = { titles: myTitles(), story: myStory(), stories: myStories() };
  if ('name' in patch) dev.name = String(patch.name || '').trim();
  if ('titles' in patch) dev.titles = cleanTitles(patch.titles);
  if ('story' in patch) dev.story = String(patch.story || '').trim().slice(0, 600);
  if ('stories' in patch) dev.stories = Object.fromEntries(Object.entries(patch.stories || {}).map(([k, v]) => [k, String(v || '').trim().slice(0, 600)]).filter(([, v]) => v));
  if ('quote' in patch) dev.quote = patch.quote === true ? 'first' : ['first', 'name', 'media'].includes(patch.quote) ? patch.quote : '';
  if ('interests' in patch) dev.interests = (patch.interests || []).filter(k => !QK.test(k));
  const p = {};
  if (signedIn() && !DEMO) {
    for (const k of ['name', 'titles', 'story', 'stories']) if (k in dev) p[k] = dev[k];
    if ('house' in patch) p.house = patch.house ?? null;
    if ('senate' in patch) p.senate = patch.senate ?? null;
    if ('interests' in patch || 'quote' in patch) {
      const cur = S.profile?.interests || [];
      const base = 'interests' in patch ? dev.interests : cur.filter(k => !QK.test(k));
      p.interests = [...new Set([...base, ...quoteKeys('quote' in patch ? dev.quote : quoteFrom(cur))])];
    }
    const { error } = await (await supa()).rpc('save_my_profile_v2', { p });
    if (error) throw error;
  }
  saveMe({ ...dev, ...(signedIn() && S.user?.id ? { acct: S.user.id } : {}) });
  // The first visit's name (Home's greeting) follows, so clearing a name never brings back an old one.
  if ('name' in dev && (wiz().name || '') !== dev.name) wizSet({ name: dev.name });
  if (signedIn()) {
    const o = S.profile ||= {};
    if ('name' in dev) o.name = dev.name || null;
    if ('titles' in dev) o.titles = dev.titles;
    if ('story' in dev) o.story = dev.story || null;
    if ('stories' in dev) o.stories = dev.stories;
    if ('house' in patch) o.house_district = patch.house ?? null;
    if ('senate' in patch) o.senate_district = patch.senate ?? null;
    if (p.interests) o.interests = p.interests;
    else if ('interests' in patch || 'quote' in patch) o.interests = [...new Set([...(dev.interests ?? (o.interests || []).filter(k => !QK.test(k))), ...quoteKeys('quote' in dev ? dev.quote : quoteFrom(o.interests || []))])];
  }
  // Counted by kind only (E1): titles or a story saved that weren't there before.
  if ('titles' in dev && dev.titles.length && JSON.stringify(dev.titles) !== JSON.stringify(was.titles)) count('profile_titles');
  if (('story' in dev && dev.story && dev.story !== was.story) || ('stories' in dev && Object.entries(dev.stories).some(([k, v]) => was.stories[k] !== v))) count('profile_story');
}
// One topic's story: '' is the story for any issue.
export const saveStory = (topic, text) => topic ? saveProfile({ stories: { ...myStories(), [topic]: text } }) : saveProfile({ story: text });

// Sign-out and a deleted account (R-156, the review): the profile leaves this device, so a shared phone never starts the
// next person's letter with the last person's name, titles, story, drafts or district. Bills followed stay on the device
// (sign-out has always said so); deleting the account clears those too (pub/profile.js).
export function forgetProfileOnDevice() {
  try {
    const me = loadMe(); PROFILE_KEYS.forEach(k => delete me[k]);   // kernel.js: the same list at sign-in
    localStorage.setItem(ME_KEY, JSON.stringify(me));
    localStorage.removeItem('hiphi_districts');
  } catch { /* private mode */ }
  if (wiz().name) wizSet({ name: '' });
  S.profile = {};
}
