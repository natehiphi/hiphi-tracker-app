// The person's profile, read and saved in one place (R-147): the walkthrough (pub/helper.js), the profile page
// (pub/profile.js) and More all use it. Nate 10/4: a profile only with a mobile number or an email.
//   on this device  hiphi_me: name, titles, story, quote, capitolAcct (the walkthrough's own store since 9/19)
//   on the account  people (backend 125, save_my_profile_v2 / my_profile_v2): name, titles, story, interests, districts;
//                   loaded at sign-in by kernel.js loadUser into S.profile
// With an email (signed in) the account is the truth and every save goes to both. With only a number the profile stays
// on this phone until texts are set up and a code by text can bring it to another (R-146). Without either, nothing here
// is called a profile, though the walkthrough still remembers a name and titles on this device for the next letter.
import { S, DEMO, supa, textSaved, wiz } from './core.js';
import { cleanTitles } from './titles.js';

const ME_KEY = 'hiphi_me';
export const loadMe = () => { try { return JSON.parse(localStorage.getItem(ME_KEY) || '{}') || {}; } catch { return {}; } };
const saveMe = patch => { try { localStorage.setItem(ME_KEY, JSON.stringify({ ...loadMe(), ...patch })); } catch { /* private mode */ } };

export const signedIn = () => !!(S.session && S.user);
// Nate 10/4: "only work with an email or phone number".
export const hasProfile = () => signedIn() || !!textSaved();
export const myName = () => String((signedIn() && S.profile?.name) || loadMe().name || (S.user?.prefs || {}).name || wiz().name || '').trim();
export const myTitles = () => cleanTitles(signedIn() && S.profile?.titles?.length ? S.profile.titles : loadMe().titles);
export const myStory = () => String((signedIn() ? S.profile?.story : '') || loadMe().story || '').trim();
export const quoteOk = () => signedIn() ? (S.profile?.interests || []).includes('quote') : !!loadMe().quote;
// How they'd help (testify in person, host, volunteer, a story to share); "quote" is asked beside the story instead.
export const myInterests = () => (signedIn() ? S.profile?.interests || [] : loadMe().interests || []).filter(k => k !== 'quote');
// "LK" for Leilani Kahale; "L" for one name; '' when there is none (the caller draws a person icon).
export function initials(name = myName()) {
  const w = String(name || '').replace(/[^\p{L}\s'-]/gu, ' ').trim().split(/\s+/).filter(Boolean);
  return w.length ? (w[0][0] + (w.length > 1 ? w[w.length - 1][0] : '')).toUpperCase() : '';
}

// Save part of the profile: { name, titles, story, quote, interests, house, senate }. Only the keys given change. The
// device always keeps name, titles, story and quote; the account (signed in, not the sandbox) gets the same through
// save_my_profile_v2, with "HIPHI may quote me" kept as the 'quote' interest as before. Throws the account's error.
export async function saveProfile(patch) {
  const dev = {};
  if ('name' in patch) dev.name = String(patch.name || '').trim();
  if ('titles' in patch) dev.titles = cleanTitles(patch.titles);
  if ('story' in patch) dev.story = String(patch.story || '').trim().slice(0, 600);
  if ('quote' in patch) dev.quote = !!patch.quote;
  if ('interests' in patch) dev.interests = (patch.interests || []).filter(k => k !== 'quote');
  saveMe(dev);
  if (!signedIn() || DEMO) {
    if (signedIn()) Object.assign(S.profile ||= {}, profileFields(patch, dev));
    return;
  }
  const p = {};
  if ('name' in patch) p.name = dev.name;
  if ('titles' in patch) p.titles = dev.titles;
  if ('story' in patch) p.story = dev.story;
  if ('house' in patch) p.house = patch.house ?? null;
  if ('senate' in patch) p.senate = patch.senate ?? null;
  if ('interests' in patch || 'quote' in patch) {
    const base = new Set('interests' in patch ? patch.interests : (S.profile?.interests || []));
    if ('quote' in patch) { if (patch.quote) base.add('quote'); else base.delete('quote'); }
    p.interests = [...base];
  }
  const { error } = await (await supa()).rpc('save_my_profile_v2', { p });
  if (error) throw error;
  Object.assign(S.profile ||= {}, profileFields(patch, dev, p));
}
function profileFields(patch, dev, p = {}) {
  const o = {};
  if ('name' in dev) o.name = dev.name || null;
  if ('titles' in dev) o.titles = dev.titles;
  if ('story' in dev) o.story = dev.story || null;
  if ('house' in patch) o.house_district = patch.house ?? null;
  if ('senate' in patch) o.senate_district = patch.senate ?? null;
  if (p.interests) o.interests = p.interests;
  else if ('interests' in patch) o.interests = patch.interests;
  return o;
}
