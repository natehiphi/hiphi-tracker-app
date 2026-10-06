// The testimony helper (redesign 9/19): a full-screen dialog that walks a first-timer from "who are you" to a letter
// sent on the Capitol website, then a real confirmation page. Three short screens instead of the old one-page form:
// the 9/18 walkthrough found Copy below the fold, name and town flagged as errors before anyone typed, a letter in a
// code font, and no word about the Capitol account, the 60-minute logout or the green box that means it worked.
// Opens over any screen with app.openHelper(billId, hearingId). The phone's Back button, Esc and the close button all
// close it. What the person writes stays in this browser (hiphi_me), so "I'll finish later" really works.
// 9/19, after Nate's review: (1) the letter follows the person. Someone whose own stance differs from HIPHI's never
// gets HIPHI's scripted letter; they get the Capitol's steps and write in their own words, and nothing is counted.
// (2) Screen 1 asks for an email the friendly way: an optional field, "we'll email you when your bills have a
// hearing". Typing it IS the consent for hearing alerts; the link goes out in the background and never blocks.
// (3) Screen 3 shows "Open the Capitol page" once, keeps "I'll finish later" in the footer where it cannot hide, and
// adds "I already sent it" for people who filed in a second window. The header says "Part 1 of 3" so it does not
// clash with the guided start's "Step 4 of 4".
// 9/28, Nate tried it (R-068): "The casual user is not going to have enough knowledge of the bill to write something
// quickly." A "Get to know the bill" step now comes first: what it does, where HIPHI stands, and HIPHI's talking points
// (bills.talking_points, migration 084), each one tap to add to the letter. The town field is gone ("the location field
// should not be one"), the letter no longer repeats the bill's description, and the closing is theirs to write.
// 9/29 (R-079, R-080): the same walkthrough writes emails too. x.mode says which:
//   'testimony'   (default) the letter to a committee, sent on the Capitol website, as above;
//   'email'       an email to the committee chair(s): at a hearing ("please pass it"), or for a bill waiting for one
//                 ("please give it a hearing"; x.h is null and x.code is the committee). It replaced the quick email box;
//   'legislators' an email to the person's own senator and/or representative at a moment they can help (speakup.js);
//   'intro'       a one-time hello to both of them, listing the issues the person follows and where they stand (no bill).
// The email modes share the stance, bill and About-you steps, then the letter has a To line and a subject, and the last
// step is SENDING (Nate: "No asking. Just providing a smooth process for either option"): the message is copied as a
// safety net, and three buttons each open a new email already filled in - the mail app, Gmail, Outlook.com - with the
// mail app first on a phone and Gmail first on a laptop. Then "Did you send it?" and the same Mahalo screen.
// 10/4 (R-141, Nate: "selecting talking points should show up in an editable box that they can see. It shouldn't be on a
// different page."): the points tapped on "Get to know the bill" appear right there, in a box under them, in the words
// that go into the letter, and the person can change them. The box (x.pointsText) is what the letter says.
// 10/4 (R-148, Nate: "their previous testimony should be ready to submit easily. A potential alert should occur if the
// bill draft has significantly changed"): a letter sent is kept (letters.js: on the device and with the account). When the
// same bill, or its twin, has another hearing, the walkthrough opens on "Your letter is ready" ('again'): the letter
// re-addressed to the new committee, chairs, date and time with the person's words kept, after a check of what changed
// since (each new draft's note; amber, and no sending as it is without opening it, when staff ticked a draft as changing
// what people should say, HIPHI's position moved, a point used was changed, or the person's own stance changed). Then the
// letter and the Capitol step: two screens instead of up to nine. "Update my letter" walks the bill step again with
// their words in place; "Start a new letter" is one tap away; "Delete my saved letter" forgets it everywhere.
// 10/4 (R-153, Nate: "Can we replicate this for emails to chairs to hear a bill if they've already done that before?";
// "all of the above"): every email too (asking a chair for a hearing or to hold it, "please pass it" at a hearing, to the
// person's own legislators). The newest email per bill is kept beside the letter; at the bill's next step it opens on
// "Your email is ready", addressed to the new people and step, with the same check; either one can start from the
// other's answers. And a short reminder to the same chair when the bill still has no hearing a week before its deadline
// (x.remind; Nate: "Yes for now, but needs to be reconsidered").
import { S, DEMO, app, esc, icon, toast, friendly, spaced, posInfo, cmteLabel, cmtesOf, codesOf, dueInfo, dateLong, timeWord, roomLabel,
  hstDay, HST, anyBill, anyHearing, markDone, toggleWatch, streamOf, reduceMotion, MILESTONES, myActions, POS_WORD, didKind,
  billPath, cleanDesc, nick, agrees, myStance, setStance, sendEmailLink, validEmail, issuesOf, issueFollowed, setFollows,
  hearingText, chairContacts, legById, legsOf, stopOf, askMark, saveDone, sessionInfo, followedIssues, alive, CHAMBER_NAME } from './core.js';
import { btn, iconBtn, notice } from './ui.js';
import { nudgeCard, wireNudge, shareFor, doShare, goDirections, roomFloor, noteGoing, downloadIcs } from './actions.js';
import { flower } from './art.js';
import { introMark } from './speakup.js';
import { readyLetter, readyMail, letterOn, letterCheck, draftNotes, draftName, keepLetter, forgetLetter } from './letters.js';
import { myDistricts } from './speakup.js';
import { hasProfile, myName, myTitles, myStory, myStories, myInterests, storyFor, otherStory, storyAsk, storyName, STORY_HINT, saveProfile } from './myprofile.js';   // R-147, R-156, R-165
import { pickTitle, withTitles, asWords, aWords, needsSelf, cleanTitles, titleLabel } from './titles.js';
import { pickerHTML, wirePicker, pendingTitle } from './titlepick.js';

const ME_KEY = 'hiphi_me', OPEN_KEY = 'hiphi_helper_open';
// The Legislature's Public Access Room: free help from a real person, by phone or at the Capitol.
const PAR_TEL = 'tel:+18085870478', PAR_SHOW = '(808) 587-0478';
const loadMe = () => { try { return JSON.parse(localStorage.getItem(ME_KEY) || '{}') || {}; } catch { return {}; } };
const saveMe = patch => { try { localStorage.setItem(ME_KEY, JSON.stringify({ ...loadMe(), ...patch })); } catch { /* private mode: the letter still works, it just is not remembered */ } };
// Which helper was open in this tab, so a phone that reloads the page while the person is on the Capitol site
// (iOS does this to background tabs) puts them back where they were.
const openMark = {
  get() { try { return JSON.parse(sessionStorage.getItem(OPEN_KEY) || 'null'); } catch { return null; } },
  set(v) { try { if (v) sessionStorage.setItem(OPEN_KEY, JSON.stringify(v)); else sessionStorage.removeItem(OPEN_KEY); } catch { /* ignore */ } },
};

// ---------------- the letter ----------------
// Public Access Room order (lrb.hawaii.gov/par, tips on testimony): address the chair, vice chair and members;
// position first; who you are; what the bill does; your own reason; the ask; mahalo. Short on purpose.
const sentence = s => { const t = String(s || '').replace(/\s+/g, ' ').trim(); return t && !/[.!?…"”)]$/.test(t) ? t + '.' : t; };
// HIPHI's plain summary; else the first sentence of the official description. Never the "Relating to" title.
// Both go through core's cleanDesc, so a drafting note ("Effective 7/1/3000. (SD1)") can never reach a letter that
// someone sends to the Legislature under their own name.
function summaryOf(b) {
  if (b.hiphi_summary) return sentence(cleanDesc(b.hiphi_summary));
  const d = cleanDesc(b.description);
  const first = ((d.match(/^.*?[.;](\s|$)/) || [d])[0] || '').trim().replace(/;$/, '.');
  return first && !/^relating to/i.test(first) ? sentence(cleanDesc(first)) : '';
}

// "Keohokapu-Lee Loy" from "Sue L. Keohokapu-Lee Loy": the directory's sort_name knows where a two-word surname
// starts (P0.9: member short names come from sort_name.split(',')[0], never "Sen. III").
const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[ʻ‘’'`.]/g, '')
  .replace(/,?\s+(jr|sr|ii|iii|iv)$/i, '').toLowerCase().replace(/\s+/g, ' ').trim();
function surname(full, chamber) {
  const f = norm(full); let best = '';
  for (const l of S.legislators || []) {
    if (chamber && l.chamber !== chamber) continue;
    const sn = (l.sort_name || '').split(',')[0].trim(), n = norm(sn);
    if (n && (f === n || f.endsWith(' ' + n)) && sn.length > best.length) best = sn;
  }
  return best || String(full || '').replace(/,?\s+(jr\.?|sr\.?|ii|iii|iv)$/i, '').trim().split(/\s+/).pop();
}
// A joint hearing is one hearing before both committees, so the letter greets every chair and vice chair.
function greeting(h) {
  const cs = cmtesOf(h.committee), joint = codesOf(h.committee).length > 1;
  const who = [...cs.filter(c => c.chair).map(c => `Chair ${surname(c.chair, c.chamber)}`),
    ...cs.filter(c => c.vice_chair).map(c => `Vice Chair ${surname(c.vice_chair, c.chamber)}`)];
  return `Dear ${who.length ? who.join(', ') : 'Chair, Vice Chair'}, and members of the committee${joint ? 's' : ''},`;
}
const OPENING = { strongly_support: 'I strongly support', support: 'I support', support_amend: 'I support', strongly_oppose: 'I strongly oppose', oppose: 'I oppose' };
// The letter says what the PERSON thinks (R-068, 9/27): a "Not sure yet" used to get "I strongly support". stance is
// 'support' | 'oppose' | 'comments'. When it matches HIPHI's position the letter carries HIPHI's wording and ask;
// otherwise it is theirs alone, and their reason is required, because it is the whole letter.
const sameAsHiphi = (b, stance) => (stance === 'support' && /support/.test(b.hiphi_position || '')) || (stance === 'oppose' && /oppose/.test(b.hiphi_position || ''));
function openingLine(b, n, stance) {
  const p = b.hiphi_position;
  if (sameAsHiphi(b, stance) && OPENING[p]) return `${OPENING[p]} ${n}${p === 'support_amend' ? ', with amendments' : ''}.`;
  return stance === 'support' ? `I support ${n}.` : stance === 'oppose' ? `I oppose ${n}.` : `I am writing with comments on ${n}.`;
}
function askLine(b, n, stance) {
  // "Hold" is the Capitol's word for a committee not passing a bill.
  return stance === 'oppose' ? `I respectfully ask the committee to hold ${n}.` : stance === 'support' ? `I respectfully ask the committee to pass ${n}.`
    : 'I respectfully ask the committee to consider these comments.';
}
const STANCE_WORD = { support: 'SUPPORT', oppose: 'OPPOSITION', comments: 'COMMENTS' };
// "Testimony in SUPPORT of HB 1", "in OPPOSITION to", "Comments on", "in SUPPORT of HB 1, with amendments" (R-120, Bug 6).
const headingFor = (word, n) => word === 'COMMENTS' ? `Comments on ${n}` : word === 'SUPPORT WITH AMENDMENTS' ? `Testimony in SUPPORT of ${n}, with amendments` : `Testimony in ${word} ${/OPPOS/.test(word) ? 'to' : 'of'} ${n}`;
// HIPHI's own position as the person's default when they have said nothing either way.
const hiphiStance = b => /oppose/.test(b.hiphi_position || '') ? 'oppose' : /support/.test(b.hiphi_position || '') ? 'support' : 'comments';
// The sign-off is the person's own (Nate 9/28: "the closing shouldn't be automatically generated"): whatever they wrote,
// with a comma, and their name under it. Nothing written: just the name.
const closingOf = c => { const t = String(c || '').replace(/\s+/g, ' ').trim(); return t && !/[,.!]$/.test(t) ? t + ',' : t; };
// The letter's top: what it is, to which committee, for which hearing. A letter sent again gets a new one (R-148).
function headBlock(b, h, stance) {
  const n = spaced(b.bill_number), room = roomLabel(h.room), ours = sameAsHiphi(b, stance);
  const when = new Date(h.scheduled_at).toLocaleDateString('en-US', { timeZone: HST, weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  return [headingFor(ours ? POS_WORD[b.hiphi_position] || 'COMMENTS' : STANCE_WORD[stance], n), cmteLabel(h.committee),
    `Hearing: ${when} at ${timeWord(h.scheduled_at)}${/^Room /.test(room) ? ', ' + room : ''}`].join('\n');
}
// ---------------- who is writing (R-147) ----------------
// The person's "I'm a..." title that fits this bill best (pub/titles.js pickTitle; R-165, Nate 10/5: "The app should
// default to one"), unless they chose their own for this letter (x.use: any number of them).
const aboutBill = b => { const is = issuesOf(b) || [];
  return { cats: [...new Set(is.map(i => i.category).filter(Boolean))], text: [nick(b), b.hiphi_summary, b.title, b.description, ...is.map(i => i.name)].filter(Boolean).join(' ') }; };
const titlesOf = o => cleanTitles(o.tp ? o.tp.chosen : o.titles || []);
// The issues a letter is about (R-165: stories by issue): the bill's issues, the ones they follow first, then (R-156's
// stories) its categories; an introduction has none (its story is the general one). topicOf: where a story saved from
// this letter goes, the first of its issues.
const catsOf = b => { if (!b) return []; const is = (issuesOf(b) || []).slice().sort((p, q) => (issueFollowed(q) ? 1 : 0) - (issueFollowed(p) ? 1 : 0));
  return [...is.map(i => i.id), ...new Set(is.map(i => i.category).filter(Boolean))]; };
const topicOf = x => { const k = catsOf(x.b)[0] || ''; return S.issueById?.get(k) ? k : ''; };
const topicName = storyName;
// x.use: the person's own choice for this letter, in the order of their titles; [] means no titles in this letter.
const twoFor = o => { const all = titlesOf(o); if (Array.isArray(o.use)) { if (!o.use.length) return []; const use = all.filter(t => o.use.includes(t)); if (use.length) return use; } return o.b ? pickTitle(all, aboutBill(o.b)) : all.slice(0, 1); };
// Where they live, said only to their own lawmakers (Nate 10/4: most letters go to legislators who aren't theirs). In
// testimony that means a committee one of their own sits on: "I live in Hilo, in Senator Inouye's district."
const legWord = l => `${l.chamber === 'S' ? 'Senator' : 'Representative'} ${surname(l.name, l.chamber)}`;
function mineOn(code) {
  const d = myDistricts(); if (!d || !code) return [];
  return legsOf(code).map(m => m.l).filter(l => (l.chamber === 'S' && +l.district === +d.senate) || (l.chamber === 'H' && +l.district === +d.house));
}
const townOf = () => { try { return (JSON.parse(localStorage.getItem('hiphi_districts') || 'null') || {}).label || ''; } catch { return ''; } };
function liveLine(h) {
  const ls = mineOn(h?.committee); if (!ls.length) return '';
  const town = townOf(), where = ls.length === 1 ? `${legWord(ls[0])}’s district` : `the districts of ${andList(ls.map(legWord))}`;
  return `I live in ${town ? `${town}, in ` : ''}${where}.`;
}
function letterFor(b, h, o) {
  const { name, why, closing = '', stance = hiphiStance(b) } = o;
  // What goes out is theirs to choose (R-156 B2): noLive leaves out where they live, noWhy their reason.
  const n = spaced(b.bill_number), ours = sameAsHiphi(b, stance), live = o.noLive ? '' : liveLine(h);
  return [
    headBlock(b, h, stance),
    greeting(h),
    `${withTitles(twoFor({ ...o, b }), openingLine(b, n, stance))} My name is ${String(name).trim()}.${live ? ` ${live}` : ''}`,
    // The points they picked, as the box on "Get to know the bill" has them (R-141), then their own reason. The
    // committee already has the bill's text, so the letter does not repeat what it does (Nate 9/28).
    ownPoints(o),
    o.noWhy && !own2For(b, stance) ? '' : sentence(why),
    [ours ? sentence(b.hiphi_action) : '', askLine(b, n, stance)].filter(Boolean).join(' '),
    [closingOf(closing), String(name).trim()].filter(Boolean).join('\n'),
  ].filter(Boolean).join('\n\n');
}
const basisOf = x => JSON.stringify([x.name.trim(), x.why.trim(), ownPoints(x), (x.closing || '').trim(), x.stance || '', twoFor(x), !!x.noLive, !!x.noWhy]);

// ---------------- the emails (R-079, R-080) ----------------
// Who an email goes to: [{ greet: 'Chair Keohokapu-Lee Loy', label: 'Sen. Jarrett Keohokapu-Lee Loy', role, email, url, leg }].
// Chairs come from core's chairContacts (the directory's address, else the Capitol pattern), as the quick email did.
const chairsTo = code => chairContacts(code).map(c => ({ greet: `Chair ${c.last}`, label: `${c.title} ${c.leg?.name || c.name}`, role: `Chair, ${c.committee}`,
  email: c.email || '', url: c.leg?.capitol_url || '', leg: c.leg || null, phone: c.phone || '', code: c.code }));
const legSurname = l => String(l.sort_name || l.name || '').split(',')[0].trim();
export const legTo = (l, role = '') => ({ greet: `${l.chamber === 'S' ? 'Senator' : 'Representative'} ${legSurname(l)}`, label: `${l.chamber === 'S' ? 'Sen.' : 'Rep.'} ${l.name}`,
  role: role || `Your ${l.chamber === 'S' ? 'senator' : 'representative'}, ${l.chamber === 'S' ? 'Senate' : 'House'} District ${l.district}`, email: l.email || '', url: l.capitol_url || '', leg: l, phone: l.phone || '' });
const andList = xs => xs.length <= 1 ? xs.join('') : xs.length === 2 ? `${xs[0]} and ${xs[1]}` : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;
// "House District 22", or "Senate District 11 and House District 22": where they live, never the street (their address
// was never kept). Only the districts of the people this email goes to.
function districtWords(to) {
  const ds = to.map(t => t.leg).filter(Boolean).sort((a, b) => a.chamber === 'S' ? -1 : b.chamber === 'S' ? 1 : 0).map(l => `${l.chamber === 'S' ? 'Senate' : 'House'} District ${l.district}`);
  return andList([...new Set(ds)]);
}
const verbFor = stance => stance === 'oppose' ? 'hold' : stance === 'support' ? 'pass' : 'consider';
// The committee's next deadline for a bill waiting for a hearing ("Mar 6"), when it has one.
const hearingBy = b => { const dl = stopOf(b).deadline; return dl && !dl.missed ? dateLong(dl.date + 'T12:00:00-10:00') : ''; };
// The one sentence that asks for something, by mode and moment.
function mailAsk(x, n, stance) {
  const { mode, h, b } = x, when = h ? dateLong(h.scheduled_at) : '', dl = b ? hearingBy(b) : '';
  const until = dl ? ` It needs one by ${dl} to stay alive this session.` : '';
  if (mode === 'email' && h) return stance === 'comments' ? `I respectfully ask the committee to consider these comments at the hearing on ${when}.`
    : `I respectfully ask the committee to ${verbFor(stance)} ${n} at the hearing on ${when}.`;
  if (mode === 'email') return stance === 'oppose' ? `I respectfully ask you not to schedule ${n} for a hearing.`
    : stance === 'support' ? `I respectfully ask you to give ${n} a hearing, so the public can weigh in.${until}` : `Please consider these comments as you decide whether to give ${n} a hearing.`;
  const m = x.moment || {}, cm = m.code ? cmteLabel(m.code) : 'the committee', the = /^the /i.test(cm) ? cm : `the ${cm}`;
  if (m.kind === 'floor') { const ch = CHAMBER_NAME[m.chamber] || 'full chamber';
    return `${n} comes to a vote of the full ${ch} soon. ${stance === 'oppose' ? 'Please vote no.' : stance === 'support' ? 'Please vote yes.' : 'Please consider these comments when you vote.'}`; }
  if (m.kind === 'hearing') return `You ${m.chair ? 'chair' : 'sit on'} ${the}, which hears ${n} on ${when}. ${stance === 'comments' ? 'Please consider these comments.' : `Please vote to ${verbFor(stance)} it.`}`;
  if (m.kind === 'chair') return stance === 'oppose' ? `As chair of ${the}, please do not schedule ${n} for a hearing.`
    : stance === 'support' ? `As chair of ${the}, please give ${n} a hearing.${until}` : `As chair of ${the}, please consider these comments as you decide whether to hear ${n}.`;
  // A member of the committee a bill waits in: the chair decides, and a colleague's word carries.
  return stance === 'oppose' ? `${n} is waiting in ${the}, where you are a member. Please urge the chair not to schedule it.`
    : stance === 'support' ? `${n} is waiting for a hearing in ${the}, where you are a member. Please urge the chair to give it a hearing.${until}`
    : `${n} is waiting in ${the}, where you are a member. Please consider these comments.`;
}
function mailSubject(x) {
  const { mode, b, h } = x, stance = x.stance || (b ? hiphiStance(b) : 'comments');
  if (mode === 'intro') return `Aloha from a constituent in ${districtWords(x.to) || 'your district'}`;
  if (x.remind) { const dl = hearingBy(b), n = spaced(b.bill_number), st = x.stance || hiphiStance(b), d = dl.replace(/^[A-Za-z]+, /, '');
    return st === 'oppose' ? `${n}: please let it rest` : st === 'support' ? `${n}: please hear it${d ? ` by ${d}` : ''}` : `${n}: my comments${d ? ` before ${d}` : ''}`; }
  const n = spaced(b.bill_number), m = x.moment || {};
  if (mode === 'email') return h ? (stance === 'comments' ? `${n}: comments for the hearing on ${dateLong(h.scheduled_at)}` : `${n}: please ${verbFor(stance)} it (hearing ${dateLong(h.scheduled_at)})`)
    : stance === 'oppose' ? `${n}: please do not schedule it` : stance === 'support' ? `${n}: please give it a hearing` : `${n}: comments`;
  const want = m.kind === 'floor' ? (stance === 'oppose' ? `please vote no on ${n}` : stance === 'support' ? `please vote yes on ${n}` : `comments on ${n}`)
    : m.kind === 'hearing' ? (stance === 'comments' ? `comments on ${n}` : `please vote to ${verbFor(stance)} ${n}`)
    : stance === 'oppose' ? `please do not schedule ${n}` : stance === 'support' ? `please help ${n} get a hearing` : `comments on ${n}`;
  return `Constituent in ${districtWords(x.to) || 'your district'}: ${want}`;
}
// The reminder to the same chair (R-153; Nate: "Yes for now, but needs to be reconsidered"): short, once, a week before the
// bill's deadline when it still has no hearing. It says they wrote before and when, their reason again, and one ask.
function reminderLetter(x) {
  const { b } = x, n = spaced(b.bill_number), stance = x.stance || hiphiStance(b), name = String(x.name).trim(), dl = hearingBy(b);
  const when = x.remindOf ? ` on ${dateLong(x.remindOf)}` : '';
  const before = stance === 'oppose' ? `I wrote to you${when} to ask you not to schedule ${n} for a hearing.`
    : stance === 'support' ? `I wrote to you${when} to ask you to give ${n} a hearing.` : `I wrote to you${when} with my comments on ${n}.`;
  const ask = stance === 'oppose' ? 'I respectfully ask you to let it rest this session.' : stance === 'support' ? `I respectfully ask you to schedule it${dl ? ' before then' : ''}.` : 'Please consider my comments as you decide.';
  return [`Dear ${andList(x.to.map(t => t.greet)) || 'Chair'},`, `${openingLine(b, n, stance)} My name is ${name}.`,
    `${before} I am writing once more because ${dl ? `its deadline is ${dl}` : 'its deadline is near'}.`, sentence(x.why), ask,
    [closingOf(x.closing), name].filter(Boolean).join('\n')].filter(Boolean).join('\n\n');
}
// A bill in the introduction: "HB 1523 (Disposable e-cigarette ban)".
const billWords = b => nick(b) ? `${spaced(b.bill_number)} (${nick(b)})` : spaced(b.bill_number);
// What the introduction lists (R-080 C): the issues they follow, the bills they took a stand on, and, as "following",
// up to five more live bills on those issues (a long list of numbers is noise to a legislator's office).
export function introFacts() {
  const all = [...new Map([...S.bills, ...Object.values(S.extra || {})].map(b => [b.id, b])).values()];
  const st = id => (S.stances || {})[id];
  const support = all.filter(b => st(b.id) === 'support'), oppose = all.filter(b => st(b.id) === 'oppose');
  const following = all.filter(b => S.watch.has(b.id) && !st(b.id) && alive(b) && posInfo(b));
  return { issues: followedIssues().map(i => i.name), support, oppose, following: following.slice(0, 5), moreFollowing: Math.max(0, following.length - 5) };
}
function mailLetter(x) {
  const { b, to } = x, name = String(x.name).trim(), why = x.noWhy && !(b && own2For(b, x.stance || hiphiStance(b))) ? '' : sentence(x.why), close = [closingOf(x.closing), name].filter(Boolean).join('\n');
  const dear = `Dear ${andList(to.map(t => t.greet)) || 'Chair'},`, where = districtWords(to), two = twoFor(x);
  // Their own lawmakers hear where they live (R-147): always in 'legislators' and 'intro', and in an email to a chair who
  // happens to be their own senator or representative; anyone else does not.
  const d = myDistricts(), isMine = l => !!d && !!l && ((l.chamber === 'S' && +l.district === +d.senate) || (l.chamber === 'H' && +l.district === +d.house));
  const ownTo = x.noLive ? [] : to.filter(t => isMine(t.leg)), own = ownTo.length > 0;
  if (x.mode === 'intro') {
    const f = introFacts(), off = sessionInfo().phase !== 'in', line = (label, bs) => bs.length ? `${label}: ${bs.map(billWords).join('; ')}.` : '';
    return [dear,
      `My name is ${name}${two.length ? `, ${aWords(two)}${needsSelf(two) ? ' writing for myself' : ''},` : ''} and I live in your district${to.length > 1 ? 's' : ''}${where ? ` (${where})` : ''}. I am writing to introduce myself and share the health issues I care about.`,
      f.issues.length ? `The issues I follow: ${andList(f.issues)}.` : '',
      [line('Bills I support', f.support), line('Bills I oppose', f.oppose),
        f.following.length ? `Bills I am following: ${f.following.map(billWords).join('; ')}${f.moreFollowing ? `, and ${f.moreFollowing} more` : ''}.` : ''].filter(Boolean).join('\n'),
      why,
      `I hope you will keep these in mind ${off ? 'in the next session' : 'this session'}. I would be glad to hear where you stand.`,
      close].filter(Boolean).join('\n\n');
  }
  const n = spaced(b.bill_number), stance = x.stance || hiphiStance(b), ours = sameAsHiphi(b, stance);
  const mine = x.mode === 'legislators' || own, ownWhere = x.mode === 'legislators' ? where : districtWords(ownTo);
  const me = mine ? `My name is ${name}, and I live in your district${ownWhere ? ` (${ownWhere})` : ''}.` : `My name is ${name}.`;
  return [dear, `${withTitles(two, openingLine(b, n, stance))} ${me}`, ownPoints(x), why,
    [ours ? sentence(b.hiphi_action) : '', mailAsk(x, n, stance)].filter(Boolean).join(' '), close].filter(Boolean).join('\n\n');
}
// The letter for whichever mode is open.
const letterOf = x => x.mode === 'testimony' ? letterFor(x.b, x.h, x) : x.remind ? reminderLetter(x) : mailLetter(x);
const isMail = x => !!x && x.mode !== 'testimony';

// The three ways to open a new email that is already filled in. Links have a length limit (a mail app on Windows cuts a
// mailto near 2,000 characters; Gmail's and Outlook's addresses near 8,000), so a longer message leaves its body out and
// the step says "paste it in": the message is on the clipboard already.
const MAILTO_MAX = 1900, WEB_MAX = 7500;
function sendLinks(x) {
  const to = x.to.map(t => t.email).filter(Boolean), e = encodeURIComponent, subj = x.subject, body = x.letter.replace(/\r?\n/g, '\r\n');
  const mk = (base, max) => { const full = base(body); return full.length <= max ? { href: full, cut: false } : { href: base(''), cut: true }; };
  return {
    app: mk(bd => `mailto:${to.join(',')}?subject=${e(subj)}${bd ? `&body=${e(bd)}` : ''}`, MAILTO_MAX),
    gmail: mk(bd => `https://mail.google.com/mail/?view=cm&fs=1&to=${e(to.join(','))}&su=${e(subj)}${bd ? `&body=${e(bd)}` : ''}`, WEB_MAX),
    outlook: mk(bd => `https://outlook.live.com/mail/0/deeplink/compose?to=${e(to.join(','))}&subject=${e(subj)}${bd ? `&body=${e(bd)}` : ''}`, WEB_MAX),
  };
}
// A phone has its own mail app; a laptop more often reads email in a browser. Never asked (Nate 9/29).
const onPhone = () => { try { return matchMedia('(pointer: coarse)').matches || innerWidth < 720; } catch { return false; } };

// The bill's own page on the Capitol website, where "Submit Testimony" lives.
function capitolUrl(b, h) {
  if (b.state_url) return b.state_url;
  const m = /^([A-Z]+)\s*(\d+)/.exec(String(b.bill_number || '').toUpperCase());
  const yr = b.session_year || (h ? +hstDay(h.scheduled_at).slice(0, 4) : sessionInfo().yr);
  return m ? `https://capitol.hawaii.gov/session/measure_indiv.aspx?billtype=${m[1]}&billnumber=${m[2]}&year=${yr}` : 'https://capitol.hawaii.gov/';
}
// The words on the Capitol testimony form.
const formWord = stance => ({ support: 'Support', oppose: 'Oppose', comments: 'Comments' })[stance] || 'Comments';
// "Sun" for a deadline earlier this week, "today", else "Mon, Mar 9".
function pastDay(iso) {
  const d = hstDay(iso), today = hstDay(Date.now());
  if (d === today) return 'today';
  const days = Math.round((Date.parse(today + 'T12:00:00Z') - Date.parse(d + 'T12:00:00Z')) / 864e5);
  return days > 0 && days < 7 ? new Date(iso).toLocaleDateString('en-US', { timeZone: HST, weekday: 'short' }) : dateLong(iso);
}
// Milestones as [key, label]. The confirmation celebrates acts only: following and taking a stand have their own
// moments elsewhere, and a first action that is a testimony gets one chip ("First testimony"), not two for one act.
const earned = () => MILESTONES.filter(m => { try { return m[3](myActions()); } catch { return false; } }).map(m => [m[0], m[1]]);
function newMilestones(before = []) {
  const had = new Set(before.map(m => m[0])), fresh = earned().filter(([k]) => !had.has(k) && k !== 'follow' && k !== 'stance');
  return fresh.filter(([k]) => !(k === 'first' && fresh.some(([k2]) => k2 === 'testimony'))).map(m => m[1]);
}

// ---------------- the email step (Nate, 9/19) ----------------
// An optional field on screen 1, only for someone who has not added their email. The label says what it is for
// ("we'll email you when your bills have a hearing"), so typing it is the consent for hearing alerts; HIPHI's own
// action alerts stay off. The link is sent in the background when they continue: it never blocks the letter, and a
// failure is one quiet line, never a dialog. One email per address per visit, however many letters they write.
let linkSentTo = '';
const linkAlready = email => linkSentTo === email || (() => { try { return sessionStorage.getItem('hiphi_link_sent') === email; } catch { return false; } })();
function sendLink(x, { again = false } = {}) {
  const email = String(x.email || '').trim();
  if (S.session || !validEmail(email) || x.link === 'sending') return;
  if (!again && linkAlready(email)) { x.link = 'sent'; x.linkTo = email; return; }
  x.link = 'sending'; x.linkTo = email; x.linkErr = '';
  // If a retry fails while focus sits on the "check your inbox" card it replaced, focus moves to the retry button.
  const redraw = () => { if (S.helper === x && (x.screen === 'done' || x.screen === 1)) paint({ focus: x.link === 'failed' && document.activeElement?.id === 'hp-inbox' ? 'hp-relink' : undefined }); };
  Promise.resolve().then(() => sendEmailLink(email, { hearing_alerts: true })).then(r => {
    linkSentTo = email; x.link = 'sent'; x.linkDemo = !!r?.demo;
    S.nudgeSent = email;   // the email ask on other screens now says "check your inbox" instead of asking again
    redraw();
  }).catch(e => { x.link = 'failed'; x.linkErr = friendly(e); redraw(); });
}

// ---------------- state ----------------
// S.helper = { b, h, screen: 'stand' | 'know' | 1 | 2 | 'acct' | 3 | 'done', name, email, why, points, pointsText, closing, letter, edited, basis, stale, copied,
//   copyChip, copyFail, saved, away, back, busy, resumed, errs, first, before, followedNow, shareChip, scrollTop,
//   focusId, opener, link: '' | 'sending' | 'sent' | 'failed', linkTo, linkErr, linkDemo }
// screen 'own' is the short screen for someone whose stance differs from HIPHI's: the Capitol's steps, no letter.
let dlg = null;          // the live <dialog>; kept across app re-renders so typing, scroll and focus survive
// What the dialog shows from outside the helper (the email ask). When it changes under us, the dialog is re-drawn.
const outside = () => JSON.stringify([S.nudge || '', S.nudgeSent || '', !!S.session]);
let drawnWith = '';
let closing = false, afterClose = null, reopen = null;

// How to find the button that opened the helper again after the page behind has been re-drawn (every element is
// new by then): its id, else its data-* hooks, else its href. Closing gives keyboard focus back to it.
function keyOf(el) {
  if (!el || el === document.body || !el.getAttribute) return '';
  if (el.id) return '#' + CSS.escape(el.id);
  const data = [...el.attributes].filter(a => a.name.startsWith('data-') && a.value !== '');
  if (data.length) return el.tagName.toLowerCase() + data.map(a => `[${a.name}="${CSS.escape(a.value)}"]`).join('');
  const href = el.getAttribute('href');
  return href ? `a[href="${CSS.escape(href)}"]` : '';
}

// Where an email's draft is kept (hiphi_me.mail, one per bill and moment): never in hiphi_me.drafts, which is testimony's
// and turns a bill's button into "Finish sending your testimony".
const mailKey = x => [x.mode, x.b?.id || '', x.h?.id || x.code || x.moment?.key || ''].join('|');
// Open the walkthrough in an email mode. o: { mode: 'email' | 'legislators' | 'intro', bill, hearing, code, legs: [ids],
// moment: { kind, key, chamber, code, chair }, stance, points, pointsText } (stance and points come along from a testimony handover).
function openMail(o = {}) {
  if (S.helper) return;
  const mode = o.mode || 'email', h = o.hearing ? anyHearing(o.hearing) : null, b = mode === 'intro' ? null : anyBill(o.bill || h?.bill_id);
  const code = mode === 'email' ? (h ? h.committee : o.code) : o.moment?.code || null;
  // o.chair: the one chair whose Email was pressed (a joint hearing has two; the button used to write to both, R-120).
  const to = (mode === 'email' ? chairsTo(code).filter(t => !o.chair || t.code === o.chair) : (o.legs || []).map(legById).filter(Boolean).map(l => legTo(l, o.roles?.[l.id]))).filter(t => t.email || t.url);
  if ((mode !== 'intro' && !b) || (o.hearing && !h) || !to.length) { toast('We couldn’t open the email helper. Try again in a moment.', { err: true }); return; }
  // Their saved story for this bill's topic (else the one for any issue) starts the "why"; a story about another topic
  // is offered, never filled in (R-156 B3).
  const me = loadMe(), mineWhy = (b && me.whyBill === b.id ? me.why || '' : mode === 'intro' ? me.introWhy || '' : ''), saved = mineWhy ? null : storyFor(catsOf(mode === 'intro' ? null : b));
  const x = { mode, b, h, code, to, moment: o.moment || null, screen: 1, name: myName(), email: me.email || '', closing: me.closing || '',
    why: mineWhy || saved?.text || '', points: o.points || [], pointsText: o.pointsText ?? pointsLine(o.points || []),
    tp: { chosen: myTitles(), q: '', more: false, active: -1 }, use: null, saveStory: false,
    whyStory: !!saved, offer: !mineWhy && !saved && mode !== 'intro' ? otherStory(catsOf(b)) : null,
    letter: '', subject: '', edited: false, basis: '', errs: {}, scrollTop: 0, focusId: '', link: '', opener: keyOf(document.activeElement) };
  if (!S.session && validEmail(x.email) && linkAlready(x.email.trim())) { x.link = 'sent'; x.linkTo = x.email.trim(); }
  const d = (me.mail || {})[mailKey(x)];
  if (b) { const mine = myStance(b.id); x.stance = mine === 'support' || mine === 'oppose' ? mine : o.stance || d?.stance || null; x.askStance = !x.stance; }
  x.screen = mode === 'intro' ? 1 : x.askStance ? 'stand' : 'know';
  // R-153: the reminder to the same chair; else an email kept from this bill's other step (or its twin's, or their
  // testimony letter's answers) comes first, re-addressed. A draft for this step wins (picked up below).
  if (o.remind && b) remindFrom(x, me, d);
  else if (b && mode !== 'intro' && !d) { const r = readyMail(b, stepKey(x)); if (r) againFrom(x, r, me); }
  else if (b && d?.again) { const r = readyMail(b, stepKey(x)); if (r) { x.again = r; x.update = !!d.update; x.keepPts = r.rec.stance === x.stance; x.letterReady = true; loadCheck(x); } }
  if (d && d.points && !o.points) { x.points = d.points; x.pointsText = d.pointsText ?? pointsLine(d.points); }
  if (d && x.name.trim() && (mode === 'intro' || x.stance) && (d.screen === 2 || d.screen === 'mail')) {
    // Back from the mail app or Gmail (a phone may have reloaded the page meanwhile): the question waits for them.
    x.screen = d.screen; x.resumed = true; x.why = d.why ?? x.why; x.edited = !!(d.edited && d.letter); x.noLive = !!d.noLive; x.noWhy = !!d.noWhy;
    x.letter = x.edited ? d.letter : letterOf(x); x.basis = x.edited ? d.basis || '' : basisOf(x);
    x.subject = d.subject || mailSubject(x); x.opened = d.opened || ''; x.asked = !!d.opened;
  }
  x.name0 = x.name.trim();   // the name they came in with: a change on the way saves to the profile (R-156)
  S.helper = x;
  openMark.set({ mode, b: b?.id || '', h: h?.id || '', o: { ...o, points: undefined, pointsText: undefined } });
  if (x.remind && x.screen === 2 && !x.resumed) x.letter = letterOf(x);
  try {
    history.replaceState({ ...(history.state || {}), y: window.scrollY }, '');
    if (!history.state?.hp) history.pushState({ ...(history.state || {}), hp: 1 }, '');
  } catch { /* ignore */ }
  app.render();
}
app.openMail = openMail;

function open(billId, hearingId) {
  if (S.helper) return;
  const h = anyHearing(hearingId), b = h && anyBill(billId || h.bill_id);
  if (!b || !h) { toast('We couldn’t open the letter helper. Try again in a moment.', { err: true }); return; }
  const me = loadMe(), d = (me.drafts || {})[h.id], fresh = !d && me.whyBill !== b.id, saved = fresh ? storyFor(catsOf(b)) : null;
  const x = { mode: 'testimony', b, h, screen: 1, name: myName(), email: me.email || '', closing: me.closing || '', points: d?.points || [],
    pointsText: d?.pointsText ?? pointsLine(d?.points || []),   // drafts saved before R-141 have only the list
    // A reason written for another bill would be out of place, so "why" comes back only for this bill. Their saved story
    // for this bill's topic (else the one for any issue) starts a new letter's "why" (R-147, R-156 B3); a story about
    // another topic is offered, never filled in.
    why: d ? d.why || '' : me.whyBill === b.id ? me.why || '' : saved?.text || '',
    whyStory: !!saved, offer: fresh && !saved ? otherStory(catsOf(b)) : null, noLive: !!d?.noLive, noWhy: !!d?.noWhy,
    tp: { chosen: myTitles(), q: '', more: false, active: -1 }, use: d?.use || null, saveStory: false,
    letter: '', edited: false, basis: '', errs: {}, scrollTop: 0, focusId: '', link: '', opener: keyOf(document.activeElement) };
  // A link already sent to this address during this visit (from an earlier letter, or before "I'll finish later"):
  // the confirmation says where to finish instead of asking again.
  if (!S.session && validEmail(x.email) && linkAlready(x.email.trim())) { x.link = 'sent'; x.linkTo = x.email.trim(); }
  // The letter's position follows the person. HIPHI's script is for people who agree with HIPHI or have not said;
  // someone who sees the bill differently gets the Capitol's own steps and writes it their way (a saved draft of
  // HIPHI's letter is left alone, in case they change their mind).
  // R-068 (9/27): everyone gets the walkthrough, whatever they think of the bill. The letter follows their own stance;
  // someone who has not said Support or Oppose is asked first. A first-timer gets one step for the Capitol account.
  const mine = myStance(b.id);
  x.stance = mine === 'support' || mine === 'oppose' ? mine : d?.stance || null;
  x.askStance = !x.stance; x.acctStep = !me.capitolAcct;
  x.screen = x.askStance ? 'stand' : 'know';
  // R-148: a letter kept from this bill's earlier hearing, or its twin's, comes first. A draft already started for this
  // hearing wins (picked up below), and remembers that it began as a letter sent again.
  if (!d) { const r = readyLetter(b, h, didKind(b, h, 'testimony')); if (r) againFrom(x, r, me); }
  else if (d.again) { const r = readyLetter(b, h, false); if (r) { x.again = r; x.update = !!d.update; x.keepPts = r.rec.stance === x.stance; x.letterReady = true; x.acctStep = false; loadCheck(x); } }
  if (d && x.stance && x.name.trim() && !didKind(b, h, 'testimony')) {
    // Pick up where they left off. Someone who left for the Capitol site and came back is ready to confirm.
    x.screen = d.screen === 3 || d.screen === 'acct' ? d.screen : 2; x.resumed = true; x.edited = !!(d.edited && d.letter);
    x.letter = x.edited ? d.letter : letterFor(b, h, x); x.basis = x.edited ? d.basis || '' : basisOf(x);
    x.back = x.screen === 3 && !!(d.away || d.back);
  }
  x.name0 = x.name.trim();   // the name they came in with: a change on the way saves to the profile (R-156)
  S.helper = x;
  openMark.set({ mode: 'testimony', b: b.id, h: h.id });
  // One history entry for the whole helper, so the phone's Back closes it. The entry under it keeps the scroll spot.
  try {
    history.replaceState({ ...(history.state || {}), y: window.scrollY }, '');
    if (!history.state?.hp) history.pushState({ ...(history.state || {}), hp: 1 }, '');
  } catch { /* ignore */ }
  app.render();
}
app.openHelper = open;

// ---------------- a letter sent again (R-148) ----------------
// The kept letter's answers become this walkthrough's: where they stand (their stance on the bill page wins if they
// changed it), their reason, their points, sign-off and name.
function againFrom(x, r, me) {
  const L = r.rec, mine = myStance(x.b.id);
  x.again = r; x.update = false; x.check = null; x.letterReady = false; x.mentions = [];
  x.stance = mine === 'support' || mine === 'oppose' ? mine : L.stance || x.stance;
  x.askStance = false; x.keepPts = L.stance === x.stance;
  if (!isMail(x) && !r.from) x.acctStep = false;   // they sent testimony before, so they have a Capitol account
  x.why = L.why || ''; x.points = L.points || []; x.pointsText = L.pointsText ?? pointsLine(x.points);
  x.closing = me.closing || L.closing || ''; x.name = me.name || L.name || '';
  x.screen = 'again';
  app.onAct?.(isMail(x) ? 'mail_again_open' : 'again_open');
  loadCheck(x);
}
// The step an email is for, as mailKey keys its draft: who it goes to (a chair, or their own legislators) and the hearing,
// the committee asked or the legislator moment. An email to their own representative about the hearing they already
// emailed the chair about is another step, so their email is offered for it.
const stepKey = x => `${x.mode}|${x.h?.id || x.code || x.moment?.key || ''}`;
// The reminder: their kept email's answers when it was this same ask, else what this device remembers. It opens on the
// email itself (About you first only if the name is missing).
function remindFrom(x, me, d) {
  const L = letterOn(x.b, 'email'), same = L && L.key === stepKey(x), mine = myStance(x.b.id);
  x.remind = true; x.remindOf = same ? L.sent : '';
  x.needName = !String(me.name || (same && L.name) || '').trim();
  x.stance = mine === 'support' || mine === 'oppose' ? mine : (same && L.stance) || x.stance || hiphiStance(x.b); x.askStance = false;
  if (same) { x.why = L.why || x.why; x.name = me.name || L.name || ''; x.closing = me.closing || L.closing || ''; }
  x.subject = mailSubject(x);
  if (!d) { x.screen = x.name.trim() ? 2 : 1; x.basis = basisOf(x); }
}
// An email kept from another step: written again from their answers for this step, unless they rewrote it by hand. Then
// every word of theirs stays, and the three pieces the walkthrough wrote for the old step (the greeting, the line that
// says who they are, the ask) are swapped for this step's, as they were sent (rec.parts). A piece not found is said.
function againMail(x) {
  const { b } = x, L = x.again.rec;
  x.mentions = []; x.askMissing = false;
  if (L.kind !== 'email' || !L.edited || !L.letter || !L.parts) { x.edited = false; return mailLetter(x); }
  let text = String(L.letter).replace(/\r\n/g, '\n');
  if (x.again.twin && L.num) text = text.split(spaced(L.num)).join(spaced(b.bill_number));
  const now = mailParts(x), was = L.parts;
  for (const k of ['dear', 'opening']) if (was[k] && now[k] && text.includes(was[k])) text = text.replace(was[k], now[k]);
  if (was.ask && now.ask && was.ask !== now.ask) { if (text.includes(was.ask)) text = text.replace(was.ask, now.ask); else x.askMissing = now.ask; }
  if (L.at) { const old = [dateLong(L.at), new Date(L.at).toLocaleDateString('en-US', { timeZone: HST, month: 'long', day: 'numeric' })];
    x.mentions = [...new Set(old.filter(w => text.includes(w)))]; }
  x.edited = true;
  return text;
}
// The pieces of the email the walkthrough writes for this step: the greeting, who they are, and the ask (its last two
// paragraphs before the sign-off are the ask; mailLetter always ends with the ask and the sign-off).
function mailParts(x) {
  const ps = mailLetter(x).split('\n\n');
  return { dear: ps[0] || '', opening: ps[1] || '', ask: ps.length >= 3 ? ps[ps.length - 2] : '' };
}
// What the person sent by email, kept for the bill's next step (letters.js keepLetter). Never the reminder: the email
// it follows up is the one worth keeping.
const mailRecOf = x => { const stance = x.stance || hiphiStance(x.b);
  return { v: 1, kind: 'email', mode: x.mode, bill: x.b.id, num: x.b.bill_number, nick: nick(x.b) || '', yr: x.b.session_year || sessionInfo().yr,
    key: stepKey(x), code: x.code || x.h?.committee || x.moment?.code || '', h: x.h?.id || '', at: x.h?.scheduled_at || '',
    sent: new Date().toISOString(), draft: x.b.current_version || '', stance, ours: sameAsHiphi(x.b, stance), pos: x.b.hiphi_position || '',
    name: String(x.name || '').trim(), why: x.why || '', points: x.points || [], pointsText: x.pointsText || '', closing: x.closing || '',
    letter: x.letter || '', edited: !!x.edited, subject: x.subject || '', parts: mailParts(x) }; };
// What changed since: the bill's draft notes, asked for once (letters.js). A failed read still compares the drafts.
function loadCheck(x) {
  draftNotes(x.b).catch(() => []).then(rows => {
    if (!x.again) return;
    x.check = letterCheck(x.b, x.again.rec, rows);
    if (x.check.level === 'big' && !x.warned) { x.warned = true; app.onAct?.('again_warned'); }
    if (S.helper === x) paint();
  });
}
// The letter for this hearing. One they never changed by hand is written again from their answers, so the committee,
// chairs, date, the bill's number and HIPHI's wording are all this hearing's. One they rewrote keeps every word of theirs:
// only its top (what it is, the committee, the hearing) and the greeting are replaced, a twin's number is swapped, and any
// sentence of theirs that still names the earlier hearing's day or committee is pointed out on the letter screen.
function againLetter(x) {
  if (isMail(x)) return againMail(x);
  const { b, h } = x, L = x.again.rec;
  x.mentions = [];
  if (L.kind === 'email' || !L.edited || !L.letter) { x.edited = false; return letterFor(b, h, x); }   // an email's answers, never its words
  let text = String(L.letter).replace(/\r\n/g, '\n');
  if (x.again.twin && L.num) text = text.split(spaced(L.num)).join(spaced(b.bill_number));
  const paras = text.split(/\n[ \t]*\n/);
  if (/^(Testimony in|Comments on)/.test(paras[0] || '')) paras[0] = headBlock(b, h, x.stance); else paras.unshift(headBlock(b, h, x.stance));
  const gi = paras.findIndex((q, i) => i > 0 && i < 4 && /^Dear /.test(q));
  if (gi >= 0) paras[gi] = greeting(h); else paras.splice(1, 0, greeting(h));
  if (L.at) {
    const was = [dateLong(L.at), new Date(L.at).toLocaleDateString('en-US', { timeZone: HST, month: 'long', day: 'numeric' }), L.code && h.committee !== L.code ? cmteLabel(L.code, { short: true }) : ''].filter(Boolean);
    const rest = paras.slice(2).join('\n\n');
    x.mentions = [...new Set(was.filter(w => rest.includes(w)))];
  }
  x.edited = true;
  return paras.join('\n\n');
}
// What the person sent, kept for the bill's next hearing (letters.js keepLetter).
const recOf = x => { const stance = x.stance || hiphiStance(x.b);
  return { v: 1, bill: x.b.id, num: x.b.bill_number, nick: nick(x.b) || '', yr: x.b.session_year || sessionInfo().yr, h: x.h.id, code: x.h.committee, at: x.h.scheduled_at,
    sent: new Date().toISOString(), draft: x.b.current_version || '', stance, ours: sameAsHiphi(x.b, stance), pos: x.b.hiphi_position || '',
    name: String(x.name || '').trim(), why: x.why || '', points: x.points || [], pointsText: x.pointsText || '', closing: x.closing || '', letter: x.letter || '', edited: !!x.edited }; };

function requestClose() {
  if (!S.helper || closing) return;
  saveDraft();
  if (history.state?.hp) {
    closing = true; history.back();
    setTimeout(() => { if (closing && S.helper) closeNow(); }, 500);   // in case Back never reports
  } else closeNow();
}
function closeNow() {
  const x = S.helper; if (!x) return;
  closing = false; saveDraft(); openMark.set(null);
  S.helper = null; dlg = null; document.body.classList.remove('hp-lock');
  // The email ask was shown on the confirmation: one ask per visit, so Home does not repeat it (unless it was sent).
  if (x.askShown && !S.nudgeSent) S.nudge = false;
  app.render();
  // After app.js has re-rendered and restored the scroll for this history step.
  setTimeout(() => {
    const next = afterClose; afterClose = null;
    if (next) { next(); return; }
    // Focus goes back to the button that opened the helper; if the page no longer has it (the card is done now),
    // to the card's own testimony button or headline, and last to the page itself, never to the top of the document.
    const id = CSS.escape(x.h?.id || '-'), find = sel => { try { return sel ? document.querySelector(sel) : null; } catch { return null; } };
    const back = [find(x.opener), document.querySelector(`[data-helper="${id}"]`), document.querySelector(`[data-mail-h="${id}"]`), document.querySelector(`#t-${id} a`), document.getElementById('main')]
      .find(el => el && el.getClientRects().length);
    back?.focus({ preventScroll: true });
    if (x.toast) toast(x.toast);
  }, 80);
}
// Back (phone button, swipe, browser) leaves the helper's history entry.
window.addEventListener('popstate', e => { if (S.helper && !e.state?.hp) closeNow(); });
// Leaving for the Capitol site and coming back is the moment to ask about the green box.
document.addEventListener('visibilitychange', () => {
  const x = S.helper; if (!x) return;
  if (document.visibilityState === 'hidden') { if (x.screen === 3) x.away = true; if (x.screen === 'acct' && x.acctNew) x.acctAway = true; saveDraft(); return; }
  // Back from Gmail or the mail app: the question is already showing (it does not wait for this), so only say so.
  if (x.screen === 'mail' && x.opened && !x.welcomed) { x.welcomed = true; if (!x.asked) { x.asked = true; paint(); } announce('Welcome back. Did you send it?'); return; }
  if (x.screen === 'acct' && x.acctAway && !x.acctBack) { x.acctBack = true; paint(); announce('Welcome back. When your account is ready, choose I’m signed up.'); return; }
  // The inline "Open the Capitol page again" appears with the green-box button, so the whole screen is re-drawn.
  if (x.screen === 3 && x.away && !x.back && !x.busy) { x.back = true; saveDraft(); paint(); announce('Welcome back. If you saw the green box, choose I saw the green box.'); }
});
window.addEventListener('pagehide', () => { if (S.helper) { if (S.helper.screen === 3) S.helper.away = true; saveDraft(); } });

// The draft lives in hiphi_me.drafts, one per hearing, and goes away once the testimony is sent.
function saveDraft() {
  const x = S.helper; if (!x) return;
  if (isMail(x)) {
    const mail = { ...(loadMe().mail || {}) }, k = mailKey(x);
    for (const [kk, v] of Object.entries(mail)) if (!v?.at || Date.now() - Date.parse(v.at) > 45 * 864e5) delete mail[kk];
    if (x.screen === 'done') delete mail[k];
    else if (x.screen === 2 || x.screen === 'mail') mail[k] = { screen: x.screen, stance: x.stance, letter: x.edited ? x.letter : '', edited: x.edited, basis: x.basis, why: x.why,
      points: x.points, pointsText: x.pointsText, subject: x.subject, opened: x.opened || '', again: !!x.again, update: !!x.update, noLive: !!x.noLive, noWhy: !!x.noWhy, at: new Date().toISOString() };
    else if (mail[k]) mail[k] = { ...mail[k], points: x.points, pointsText: x.pointsText, stance: x.stance, at: new Date().toISOString() };
    saveMe({ mail });
    return;
  }
  const drafts = { ...(loadMe().drafts || {}) };
  for (const [k, v] of Object.entries(drafts)) if (!v?.at || Date.now() - Date.parse(v.at) > 45 * 864e5) delete drafts[k];
  if (x.screen === 'done') delete drafts[x.h.id];
  // Back on the bill step with a letter already saved: the points they changed go with it.
  else if ((x.screen === 'know' || x.screen === 1) && drafts[x.h.id]) drafts[x.h.id] = { ...drafts[x.h.id], points: x.points, pointsText: x.pointsText, use: x.use || null, at: new Date().toISOString() };
  else if (x.screen === 2 || x.screen === 3 || x.screen === 'acct') drafts[x.h.id] = { screen: x.screen, stance: x.stance, letter: x.edited ? x.letter : '', edited: x.edited, basis: x.basis, why: x.why, points: x.points, pointsText: x.pointsText,
    away: !!x.away, back: !!x.back, again: !!x.again, update: !!x.update, use: x.use || null, noLive: !!x.noLive, noWhy: !!x.noWhy, at: new Date().toISOString() };
  saveMe({ drafts });
}

// ---------------- rendering ----------------
// The steps this person walks, in order: "Where do you stand?" only when they had not said, then the bill itself (9/28),
// the Capitol account only the first time (R-068). "Part 2 of 5" counts these.
// An email: the same steps up to the letter, then 'mail' (sending) instead of the Capitol account and the Capitol page.
// The introduction has no bill, so it starts with About you.
// A letter sent again: 'again', the letter, the Capitol (R-148); "Update my letter" puts the bill step and About you back in.
const seqOf = x => x.mode === 'intro' ? [1, 2, 'mail'] : x.remind ? [x.needName && 1, 2, 'mail'].filter(Boolean)
  : isMail(x) ? (x.again && !x.update ? ['again', 2, 'mail'] : [x.again && 'again', x.askStance && 'stand', 'know', 1, 2, 'mail'].filter(Boolean))
  : x.again && !x.update ? ['again', 2, x.acctStep && 'acct', 3].filter(Boolean)
  : [x.again && 'again', x.askStance && 'stand', 'know', 1, 2, x.acctStep && 'acct', 3].filter(Boolean);
const stepNo = x => Math.max(1, seqOf(x).indexOf(x.screen) + 1);
function goTo(screen) {
  const x = S.helper; if (!x) return;
  if (screen === 2 && x.screen === 'again' && !x.letterReady) { x.letter = againLetter(x); x.basis = basisOf(x); x.letterReady = true; x.stale = false;
    if (isMail(x)) { x.subject = mailSubject(x); x.subjectEdited = false; } }
  if (screen === 2 && x.screen === 1) {
    const basis = basisOf(x);
    if (!x.edited) { x.letter = letterOf(x); x.basis = basis; x.stale = false; }
    else x.stale = basis !== x.basis;
    if (isMail(x) && !x.subjectEdited) x.subject = mailSubject(x);
  }
  if (screen === 'mail') {
    // The safety net (R-079): the message is on the clipboard before any button is chosen, in this same tap (a phone
    // allows a copy only inside one). If a mail app opens empty or cuts it short, it can be pasted in.
    const ta = dlg?.querySelector('#hp-letter'); if (ta) x.letter = ta.value;
    x.autoCopied = false; x.opened = x.opened || ''; x.asked = !!x.opened;
    copyText(x.letter).then(ok => { if (S.helper === x && x.screen === 'mail') { x.autoCopied = ok; paint(); } });
  }
  if (x.forgotten && screen !== 'know' && screen !== 'stand') x.forgotten = null;
  x.screen = screen; x.resumed = false; x.copyChip = false; x.copied3 = false; x.trouble = false;
  saveDraft();
  paint({ focus: 'hp-sh', top: true });
}
const goNext = () => { const x = S.helper, s = seqOf(x); goTo(s[Math.min(s.length - 1, s.indexOf(x.screen) + 1)]); };
const goBack = () => { const x = S.helper, s = seqOf(x); const i = s.indexOf(x.screen); if (i > 0) goTo(s[i - 1]); };
// The dialog's name: "Testimony on HB 1523", "Email about HB 1523", "Write to Rep. Marten", "Introduce yourself".
const shortName = t => t.leg ? `${t.leg.chamber === 'S' ? 'Sen.' : 'Rep.'} ${legSurname(t.leg)}` : t.greet;
const titleOf = x => x.mode === 'intro' ? 'Introduce yourself' : x.mode === 'legislators' ? `Write to ${x.to.length === 1 ? shortName(x.to[0]) : 'your legislators'}`
  : `${x.mode === 'email' ? 'Email about' : 'Testimony on'} ${spaced(x.b.bill_number)}`;
function inner() {
  const x = S.helper, done = x.screen === 'done', total = seqOf(x).length, step = done ? total : stepNo(x), title = titleOf(x);
  // "Part 1 of 3", not "Step 1 of 3": people often arrive straight from the guided start's "Step 4 of 4". It is said
  // once for screen readers, in the screen's own heading (the dialog's name stays "Testimony on HB 1523").
  const head = done ? `<p class="hp-title">${esc(title)}</p>`
    : `<h2 class="hp-title" id="hp-title" tabindex="-1">${esc(title)}</h2><span class="hp-count" aria-hidden="true">Part ${step} of ${total}</span>`;
  const body = done ? (isMail(x) ? mailDoneScreen() : doneScreen()) : x.screen === 'again' ? againScreen() : x.screen === 'stand' ? standScreen() : x.screen === 'know' ? knowScreen() : x.screen === 1 ? aboutScreen()
    : x.screen === 2 ? letterScreen() : x.screen === 'mail' ? mailScreen() : x.screen === 'acct' ? acctScreen() : sendScreen();
  return `<div class="hp-frame">
    <header class="hp-head">${iconBtn('x', 'Close', { 'data-hp': 'close' }, 'hp-x')}${head}</header>
    <div class="hp-prog${done ? ' done' : ''}" aria-hidden="true">${Array.from({ length: total }, (_, i) => `<i class="${i + 1 < step || done ? 'on' : i + 1 === step ? 'on now' : ''}"></i>`).join('')}</div>
    <div class="hp-body" id="hp-body"><div class="hp-in">${body}</div></div>
    <div class="hp-foot">${foot()}</div>
    <p class="sr" id="hp-live" role="status" aria-live="polite"></p>
  </div>`;
}
const screenHead = (step, title) => `<h3 class="hp-h" id="hp-sh" tabindex="-1"><span class="sr">Part ${stepNo(S.helper)} of ${seqOf(S.helper).length}: </span>${title}</h3>`;
const welcomeBack = () => S.helper.resumed ? notice('ok', 'circle-check', `Welcome back. Your ${isMail(S.helper) ? 'email' : 'letter'} is saved right where you left it.`) : '';

// Where do you stand? Asked only of someone who had not said Support or Oppose on the bill page (R-068: the letter used
// to say "I strongly support" for a "Not sure yet"). The answer is theirs; HIPHI's position is said once, quietly.
function standScreen() {
  const x = S.helper, { b } = x, n = spaced(b.bill_number), p = posInfo(b);
  const opt = (v, label, sub = '') => `<button type="button" class="hp-choice" data-hp="stance" data-v="${v}" aria-pressed="${x.stance === v}"><b>${label}</b>${sub ? `<span>${sub}</span>` : ''}</button>`;
  // What the bill does, right where they decide (Nate 9/29): nobody should have to pick a side on a number.
  const w = summaryOf(b), name = nick(b);
  return `<div class="hp-top">${screenHead(1, `Where do you stand on ${esc(n)}?`)}</div>
    ${w || name ? `<div class="card hp-kn"><div>${name ? `<p class="hp-knh">${esc(name)}</p>` : ''}${w ? `<p class="hp-knw">${esc(w)}</p>` : ''}</div></div>` : ''}
    ${forgotNote(x)}
    <p class="hp-sub hp-standsub">Your ${isMail(x) ? 'email' : 'testimony'} is yours: say what you think.${p ? ` ${esc(p.text)} it.` : ''}</p>
    <div class="hp-choices" role="group" aria-labelledby="hp-sh">${opt('support', 'I support it')}${opt('oppose', 'I oppose it')}${opt('comments', 'I have comments', 'Not for or against, or for it with changes')}</div>`;
}

// Your letter is ready (R-148): what it is, where it goes now, and what changed since. The check decides the heading and
// the footer: "Your letter is ready" and "Use my letter" when nothing big changed; "Your letter needs a check" and "Check
// my letter" when something did (fresh-eyes review 10/4: the heading must not say "ready" over an amber box). Either way
// the main button opens the letter, with the change beside it; going over the bill and its points again is a link in the
// box, and "Start a new letter" the one other button.
const HIPHI_PAST = { strongly_support: 'strongly supported', support: 'supported', support_amend: 'supported, with changes,', strongly_oppose: 'strongly opposed', oppose: 'opposed', neutral: 'had comments on' };
// adviceOnly: beside the letter and on the bill step, only what to do (the draft's own note was on the first screen).
function bigWords(c, b, { adviceOnly = false } = {}) {
  return c.big.map(r => r.kind === 'tick' ? (adviceOnly && r.note ? `<li><b>HIPHI’s advice:</b> ${esc(sentence(r.note))}</li>`
      : `<li><b>${esc(draftName(r.version))}:</b> ${esc(sentence(r.summary))}${r.note ? `<span class="hp-advice"><b>HIPHI’s advice:</b> ${esc(sentence(r.note))}</span>` : ''}</li>`)
    : r.kind === 'position' ? `<li>HIPHI’s position changed. It ${esc(HIPHI_PAST[r.from] || 'took no side on')} the bill when you wrote, and ${esc(r.to ? (posInfo(b)?.text || 'HIPHI').replace(/^HIPHI\s*/, '') : 'takes no side on')} it now. Your letter used HIPHI’s earlier words.</li>`
    : r.kind === 'points' ? '<li>HIPHI changed or took out a talking point you used.</li>'
    : `<li>You now ${r.to === 'oppose' ? 'oppose' : 'support'} this bill. Your letter ${r.from === 'oppose' ? 'opposes' : r.from === 'support' ? 'supports' : 'comments on'} it.</li>`).join('');
}
const shortDay = iso => new Date(iso).toLocaleDateString('en-US', { timeZone: HST, month: 'short', day: 'numeric' });   // "Feb 18": no second weekday beside the deadline's
function changesBox(x) {
  const c = x.check, { b, h } = x;
  if (!c) return `<p class="hp-quiet hp-checking" role="status">${icon('loader-circle')}<span>Checking whether the bill has changed…</span></p>`;
  const read = capitolLink(b, h, 'Read the bill as it is now', { kind: 'text', sm: true, cls: 'hp-inl' });
  const again = btn('Go over the bill and talking points again', { kind: 'text', sm: true, cls: 'hp-inl', attrs: { 'data-hp': 'again-update' } });
  const notes = list => list.length ? `<ul class="hp-drafts" role="list">${list.map(n => `<li><b>${esc(draftName(n.version))}:</b> ${esc(n.summary)}</li>`).join('')}</ul>` : '';
  const missing = c.missing ? `<p>We haven’t summed up what ${esc(draftName(c.now))} changed yet.${posInfo(b) ? ` ${esc(posInfo(b).text)} the bill as it is now.` : ''}</p>` : '';
  if (c.level === 'big') return `<div class="notice warn hp-again-warn" id="hp-again-warn">${icon('triangle-alert')}<div>
      <p class="strong">What changed</p>
      <ul class="hp-why-list" role="list">${bigWords(c, b)}</ul>
      ${c.since.some(n => !n.changes_letters) ? `<p class="small">Also changed since you wrote:</p>${notes(c.since.filter(n => !n.changes_letters))}` : ''}
      ${missing}<div class="hp-boxlinks">${again}${read}</div></div></div>`;
  if (c.twin) return `<div class="notice info">${icon('info')}<div><p><b>This is a different bill with the same idea.</b> Its words may not match ${esc(spaced(x.again.rec.num))}’s, so read it before you send.</p><div class="hp-boxlinks">${again}${read}</div></div></div>`;
  if (c.level === 'changed') return `<div class="notice info">${icon('info')}<div><p><b>The bill has changed since you wrote this.</b>${c.since.length ? ' What changed:' : ''}</p>${notes(c.since)}${missing}<div class="hp-boxlinks">${again}${read}</div></div></div>`;
  return notice('ok', 'circle-check', 'The bill hasn’t changed since you wrote this.');
}
// After "Delete this saved letter": said once, with Undo, until they move on.
const savedWord = r => r?.rec?.kind === 'email' ? 'email' : 'letter';   // what "Delete this saved …" deletes: the kept one
const forgotNote = x => x.forgotten ? `<div class="notice ok hp-forgot" role="status">${icon('circle-check')}<div><p>Your saved ${savedWord(x.forgotten)} is deleted.</p>${btn('Undo', { kind: 'text', sm: true, icon: 'undo-2', cls: 'hp-inl', attrs: { 'data-hp': 'again-undo' } })}</div></div>` : '';
const againTitle = x => `Your ${isMail(x) ? 'email' : 'letter'} ${x.check?.level === 'big' ? 'needs a check' : 'is ready'}`;
function againScreen() {
  if (isMail(S.helper)) return againMailScreen(S.helper);
  const x = S.helper, { b, h } = x, L = x.again.rec, n = spaced(b.bill_number), due = dueInfo(h);
  const was = L.at ? shortDay(L.at) : '', when = dateLong(h.scheduled_at), big = x.check?.level === 'big';
  const sent = L.kind === 'email' ? 'email' : 'letter', wasL = L.sent ? shortDay(L.sent) : was;
  const lede = r => r.from ? `We’ve written your letter to the ${cmteLabel(h.committee)} from your ${wasL ? `${wasL} ` : ''}email on ${spaced(L.num)}, for the hearing on ${when}.`
    : r.twin ? `You wrote testimony on ${spaced(L.num)}, this bill’s twin in the other chamber${was ? `, on ${was}` : ''}. We’ve put in ${n}’s number, committee and date.`
    : `We’ve addressed your ${was ? `${was} ` : ''}${sent} on ${n} to the hearing on ${when}.${big ? '' : ' Your words stay the same.'}`;
  const dueLine = h.testimony_deadline ? `Testimony due ${dateLong(h.testimony_deadline)} at ${timeWord(h.testimony_deadline)}` : '';
  return `<div class="hp-top">${screenHead(1, esc(againTitle(x)))}
      <p class="hp-sub">${esc(lede(x.again))}</p></div>
    ${due?.late ? lateBanner(h) : dueLine ? `<p class="hp-due ${due?.tone || ''}">${icon('clock')}<span>${esc(dueLine)}</span></p>` : ''}
    ${changesBox(x)}`;
}

// "Chair San Buenaventura and Chair Wakai" for a chair; "Rep. Marten" for their own legislator.
const toNames = x => andList(x.to.map(t => x.mode === 'email' ? t.greet : shortName(t)));
// An email ready again (R-153): who it goes to now and why now (whyNow: the hearing, the wait, the person's own legislator),
// then the same check.
function againMailScreen(x) {
  const { b } = x, L = x.again.rec, n = spaced(b.bill_number), big = x.check?.level === 'big', names = toNames(x);
  const was = L.sent ? shortDay(L.sent) : '', words = big ? '' : ' Your words stay the same.';
  // Why it is back (fresh-eyes review 10/4): the bill moved on. For a bill waiting for a hearing: who decides now, and only
  // the deadline after (the To cards on the next screen name them in full).
  const ch = c => CHAMBER_NAME[S.committees[codesOf(c || '')[0]]?.chamber] || '', nowCh = ch(x.code), thenCh = ch(L.code);
  const who = x.mode === 'email' && !x.h ? `the ${x.to.length > 1 ? `${x.to.length === 2 ? 'two' : x.to.length} ${nowCh} chairs who decide` : `${nowCh} chair who decides`} on its hearing`.replace(/\s+/g, ' ') : names;
  const moved = x.mode === 'email' && !x.h && thenCh && nowCh && thenCh !== nowCh ? `${n} passed the ${thenCh}. ` : x.mode === 'email' && !x.h && L.code && L.code !== x.code ? `${n} is in its next committee. ` : '';
  const lede = x.again.from ? `We’ve written your email to ${who} from your ${was ? `${was} ` : ''}testimony on ${spaced(L.num)}.`
    : x.again.twin ? `You emailed about ${spaced(L.num)}, this bill’s twin in the other chamber${was ? `, on ${was}` : ''}. We’ve put in ${n}’s number and addressed it to ${who}.`
    : `${moved}We’ve addressed your ${was ? `${was} ` : ''}email to ${who}.${words}`;
  const dl = x.mode === 'email' && !x.h ? hearingBy(b) : '';
  return `<div class="hp-top">${screenHead(1, esc(againTitle(x)))}
      <p class="hp-sub">${esc(lede)}</p></div>
    ${x.mode === 'email' && !x.h ? (dl ? `<p class="hp-due hp-why">${icon('hourglass')}<span>If it isn’t heard by ${esc(dl)}, it stops for this year.</span></p>` : '') : whyNow(x)}
    ${changesBox(x)}`;
}

// Get to know the bill (Nate 9/28: "The casual user is not going to have enough knowledge of the bill to write something
// quickly. Providing them more info about what the bill is and maybe some talking points about it would be helpful.").
// What it does in plain words, where HIPHI stands and why, and HIPHI's talking points as toggles: each tap adds or
// removes one in the letter. The points argue HIPHI's side, so they are offered only to someone on that side (or with
// comments on a bill HIPHI comments on); anyone else is told the next step is theirs to write.
// Why this email, now: the hearing, the wait, or the person's own legislator's part in it (R-080).
function whyNow(x) {
  const { b, h } = x, m = x.moment || {}, who = x.to.map(t => `${shortName(t)}${t.leg ? `, your ${t.leg.chamber === 'S' ? 'senator' : 'representative'},` : ''}`);
  const cm = code => { const c = cmteLabel(code); return /^the /i.test(c) ? c : `the ${c}`; }, dl = hearingBy(b);
  let ic = 'clock', text;
  if (x.mode === 'email') {
    if (h) text = hearingText(h);
    else { ic = 'hourglass'; text = `Waiting for a hearing in ${cm(x.code)}. The ${x.to.length > 1 ? 'chairs decide' : 'chair decides'} which bills get one.${dl ? ` If it is not heard by ${dl}, it stops for this year.` : ''}`; }
  } else {
    ic = 'user-check';
    const one = andList(who);   // "Rep. Marten, your representative," reads on into its verb
    text = m.kind === 'floor' ? `Waiting for a vote of the full ${CHAMBER_NAME[m.chamber] || 'chamber'}. ${one} votes on it.`
      : m.kind === 'hearing' ? `${one} ${m.chair ? 'chairs' : 'sits on'} ${cm(m.code)}, which hears it ${dateLong(h.scheduled_at)}.`
      : m.kind === 'chair' ? `Waiting for a hearing in ${cm(m.code)}. ${one} chairs it and decides.`
      : `Waiting for a hearing in ${cm(m.code)}. ${one} is a member. The chair decides which bills get one.`;
  }
  return `<p class="hp-due hp-why">${icon(ic)}<span>${esc(text)}</span></p>`;
}
const pointsOf = x => { const pts = (x.b.hiphi_points || []).filter(Boolean); return (x.stance || hiphiStance(x.b)) === hiphiStance(x.b) ? pts : []; };
// The points' box (R-141). Until the person changes it, it holds the picked points in the order the bill lists them; once
// they have written in it, it is theirs, and a tap only adds a point's words at the end or takes them out. A point counts
// as picked while its opening words are in the box (its first five, or as many as tell it from the others), whatever the
// capitals: adding a clause or a lead-in ("As a school nurse, nicotine is...") must not make the card say Add again,
// or people add the same point twice. So the Add / Added on each point always describes what the box says.
const pointsLine = pts => pts.map(sentence).join(' ');
const wordsOf = p => String(p).trim().split(/\s+/);
function heads(pts) {
  const ws = pts.map(wordsOf);
  for (let k = 5; ; k++) {
    const hs = ws.map(w => w.slice(0, k).join(' ').toLowerCase());
    // A short point's last word loses its full stop, so "Kids don't smoke alone!" still counts.
    if (new Set(hs).size === hs.length || ws.every(w => w.length <= k)) return ws.map(w => w.slice(0, k).map((x, i, a) => i === a.length - 1 ? x.replace(/[.!?…,;:"”’)]+$/, '') || x : x));
  }
}
const headRx = w => new RegExp(w.map(x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/['’]/g, '[\'’]')).join('\\s+'), 'i');
const pickedIn = (x, text) => { const all = pointsOf(x), hs = heads(all); return all.filter((p, i) => headRx(hs[i]).test(text)); };
// Where a point the person has rewritten sits in the box: from its opening words to the end of that sentence.
function pointSpan(x, text, s) {
  const all = pointsOf(x), m = headRx(heads(all)[all.indexOf(s)] || wordsOf(s)).exec(text); if (!m) return null;
  const end = /[.!?…]["”’)]*(?=\s|$)/.exec(text.slice(m.index + m[0].length));
  return [m.index, end ? m.index + m[0].length + end.index + end[0].length : text.length];
}
function cutPoint(text, s) {
  const i = text.indexOf(s); if (i < 0) return text;
  const before = text.slice(0, i).replace(/[ \t]+$/, ''), after = text.slice(i + s.length).replace(/^[ \t]+/, '');
  return (before + (before.trim() && after.trim() && !/\n$/.test(before) && !/^\n/.test(after) ? ' ' : '') + after).trim();
}
// What the letter says for the points: the box, but only while points are offered (someone who changed their stance to
// one HIPHI's points argue against never sends them).
// A letter sent again keeps the person's own words for the points (x.keepPts) even if HIPHI has since changed the list,
// unless they changed sides (then HIPHI's points would argue against them).
const ownPoints = x => x.b && (pointsOf(x).length || x.keepPts) ? String(x.pointsText || '').trim() : '';
function knowScreen() {
  const x = S.helper, { b, h } = x, n = spaced(b.bill_number), p = posInfo(b), due = isMail(x) ? null : dueInfo(h), name = nick(b), w = summaryOf(b), pts = pointsOf(x);
  const act = sentence(b.hiphi_action);
  const pt = (s, i) => { const on = x.points.includes(s);
    return `<li><button type="button" class="hp-pt" data-hp="point" data-i="${i}" aria-pressed="${on}"><span class="hp-pti" aria-hidden="true">${icon(on ? 'check' : 'plus')}</span>
      <span class="hp-ptt">${esc(s)}</span><span class="hp-pta" aria-hidden="true">${on ? 'Added' : 'Add'}</span></button></li>`; };
  return `<div class="hp-top">${screenHead(0, x.again ? 'Update your letter' : 'Get to know the bill')}
      <p class="hp-sub">${x.again ? 'What changed, the bill as it is now, and your points. Your letter keeps your words until you change them.' : 'A minute with what it does, then we’ll help you write.'}</p></div>
    ${due?.late ? lateBanner(h) : ''}
    ${forgotNote(x)}
    ${x.again && x.check?.level === 'big' ? `<div class="notice warn">${icon('triangle-alert')}<div><ul class="hp-why-list" role="list">${bigWords(x.check, b, { adviceOnly: true })}</ul></div></div>` : ''}
    <div class="card hp-kn">
      <div><p class="hp-knh">${esc(n)}${name ? ` · ${esc(name)}` : ''}</p>
        <p class="hp-knw">${esc(w || cleanDesc(b.title) || '')}</p>
        ${capitolLink(b, h, 'Read the bill on the Capitol website', { kind: 'text', sm: true, cls: 'hp-inl' })}</div>
      ${p ? `<div><p class="hp-knh">Where HIPHI stands</p><p>${esc(p.text)} it.${act ? ' ' + esc(act) : ''}</p></div>` : ''}
      ${due && !due.late ? `<p class="hp-due ${due.tone}">${icon('clock')}<span>${due.html}</span></p>` : ''}
      ${isMail(x) ? whyNow(x) : ''}
    </div>
    ${pts.length ? `<section class="hp-ptsec" aria-labelledby="hp-pth"><h4 class="hp-knh" id="hp-pth">Points you can make</h4>
        <p class="help" id="hp-pthelp">Tap any to add it to your ${isMail(x) ? 'email' : 'letter'}, or skip them.</p>
        <ul class="hp-pts" role="list" aria-describedby="hp-pthelp">${pts.map(pt).join('')}</ul>
        ${x.points.length || x.pointsText.trim() ? `<div class="field hp-ptbox"><label for="hp-pts">In your ${isMail(x) ? 'email' : 'letter'}</label>
          <textarea id="hp-pts" class="hp-ptsta" rows="2" aria-describedby="hp-pts-help" spellcheck="true" autocapitalize="sentences">${esc(x.pointsText)}</textarea>
          <span class="help" id="hp-pts-help">Change any words you like. Next, you’ll add your name and why it matters to you.</span></div>` : ''}</section>`
      : `<p class="hp-own">${icon('pencil')}<span>${x.stance && x.stance !== hiphiStance(b) ? `Next, you’ll say what you think in your own words. That is what ${x.mode === 'legislators' ? 'your legislator' : 'the committee'} wants to hear.` : 'Next, you’ll add why it matters to you, in a sentence or two.'}</span></p>`}`;
}

// Under the picker (R-147): how the letter will start with the two titles chosen, and, for someone with more than two,
// a way to choose the two for this letter only. Redrawn on its own when a title is picked (the picker keeps its focus).
// The step's titles (review 10/4): someone who has titles sees them as this letter's choice, the two in use ticked and
// any other one a tap away (a tap never changes the profile); "Add a title" opens the picker, the one way that adds to
// their profile. Someone with none gets the picker straight away.
// R-156 (the review): someone with no titles gets one "Add a title" button, not the whole picker in the middle of a letter
// (C-5, B-12); "Add a title" opens the picker in its add-only form, so a tap there only ever adds to the profile and a
// tap on the chips above only ever changes this letter (one meaning each). "Done adding" goes back to the chips.
function titlesStep(x) {
  const all = titlesOf(x), word = isMail(x) ? 'email' : 'letter';
  if (x.tp.adding) return pickerHTML('hp', x.tp, { hint: `Tap to add to your profile. Then pick which ones this ${word} uses.`, addOnly: true });
  const two = twoFor(x);
  return `<fieldset class="tp" id="hp-tp"><legend class="tp-leg">I’m a… <span class="tp-hint">${!all.length ? `Optional. Your ${word} can start with who you are, like “As a parent…”.` : all.length > 1 ? `We picked the one that fits this bill. Tap to use more, or a different one.` : `Tap to leave it out of this ${word}.`}</span></legend>
    <div class="chips tp-chips">${all.map(t => `<button type="button" class="chip tp-c" data-hp="use" data-v="${esc(t)}" aria-pressed="${two.includes(t)}">${two.includes(t) ? icon('check') : ''}<span>${esc(titleLabel(t))}</span></button>`).join('')}</div>
    <button type="button" class="explain tp-morebtn tp-add" data-hp="addtitle">${icon('plus')}<span>Add a title</span></button></fieldset>`;   // a text button, not one of the titles (the review of R-165)
}
function titlesAfter(x) {
  const all = titlesOf(x); if (!all.length) return '';
  const two = twoFor(x), word = isMail(x) ? 'email' : 'letter';
  const start = x.b ? withTitles(two, openingLine(x.b, spaced(x.b.bill_number), x.stance || hiphiStance(x.b))) : `${aWords(two)}${needsSelf(two) ? ', writing for myself' : ''}`;
  return `<p class="hp-tp-prev" id="hp-tp-prev">${icon('file-text')}<span>Your ${word} ${x.b ? 'starts' : 'says you’re'}: “${esc(start)}${x.b ? '' : '.'}”</span></p>`;
}
function paintTitles({ step = false } = {}) {
  const x = S.helper, box = dlg?.querySelector('#hp-tp-after'), host = dlg?.querySelector('#hp-tp-host'); if (!x || !box) return;
  const a = document.activeElement, had = host?.contains(a) ? a.dataset.v || a.dataset.tp || a.dataset.hp : '';
  if (step && host) { host.innerHTML = titlesStep(x); wireTitles(); }
  box.innerHTML = titlesAfter(x);
  if (step && had) (host.querySelector(`[data-v="${CSS.escape(had)}"]`) || host.querySelector(`[data-tp="${CSS.escape(had)}"]`) || host.querySelector('button'))?.focus({ preventScroll: true });
}
function wireTitles() {
  const x = S.helper, host = dlg?.querySelector('#hp-tp-host'); if (!x || !host || !x.tp || !host.querySelector('[data-tp], [data-tp-add], #hp-tq')) return;
  wirePicker(host, 'hp', x.tp, (chosen, o) => { x.use = (x.use || []).filter(t => chosen.includes(t)); if (!x.use.length) x.use = null; saveDraft();
    if (o?.done) { x.tp.adding = false; x.tp.q = ''; paintTitles({ step: true }); host.querySelector('[data-hp="addtitle"]')?.focus({ preventScroll: true }); } else paintTitles(); });
}

// Screen 1: who you are. Errors show only after someone leaves a field or chooses See my letter (Guide B).
function aboutScreen() {
  const x = S.helper;
  const field = (f, label, ac, extra = '') => {
    const bad = x.errs[f];
    return `<div class="field"><label for="hp-${f}">${label}</label>
      <input id="hp-${f}" name="${f}" type="text" autocomplete="${ac}" autocapitalize="words" enterkeyhint="next" value="${esc(x[f])}"${bad ? ` aria-invalid="true" aria-describedby="hp-${f}-err"` : ''}${extra}>${bad ? errHTML(f) : ''}</div>`;
  };
  // The email step: only for someone who has not added their email yet. A person who is signed in already gets alerts
  // from their settings, so the field would only be noise.
  const bad = x.errs.email;
  // Someone with a profile (an email, or a text-alert number since R-147) is not asked again in the middle of a letter.
  const email = S.session || hasProfile() ? '' : `<div class="field"><label for="hp-email">Your email <span class="hp-opt">(optional)</span></label>
      <input id="hp-email" name="email" type="email" inputmode="email" autocomplete="email" autocapitalize="off" spellcheck="false" enterkeyhint="next" value="${esc(x.email)}"
        aria-describedby="${bad ? 'hp-email-err ' : ''}hp-email-help"${bad ? ' aria-invalid="true"' : ''}>${bad ? errHTML('email') : ''}
      <span class="help" id="hp-email-help">We’ll email you when a bill on your issues has a hearing. No password.${isMail(x) ? '' : ' Your email is never part of your letter.'}</span>
      ${x.link === 'failed' && x.linkTo === x.email.trim() ? `<span class="hp-quiet" role="status">${icon('info')}<span>We couldn’t send your link just now. We’ll try again when you continue.</span></span>` : ''}</div>`;
  const picked = x.points.length, mine = ownPoints(x), asTapped = mine === pointsLine(x.points);
  return `<div class="hp-top">${screenHead(1, 'About you')}
      ${mine ? `<p class="hp-sub">${!asTapped ? 'Your points are' : picked === 1 ? 'The point you picked is' : `The ${picked} points you picked are`} in your ${isMail(x) ? 'email' : 'letter'}. Add your own reason if you can.</p>` : ''}</div>
    ${isMail(x) ? notice('info', 'info', `Your email goes from your own email account straight to ${esc(andList(x.to.map(shortName)))}. HIPHI never sees it or sends it for you. Share only what you’re comfortable with. You don’t have to share health details to be heard.`)
      : notice('info', 'info', 'Testimony is a short letter to the committee deciding this bill. Anyone in Hawaiʻi can send one. It’s public: your name and letter are posted on the Capitol website. Share only what you’re comfortable with. You don’t have to share health details to be heard.')}
    <form id="hp-form" class="hp-form" novalidate>
      ${field('name', 'Your name', 'name')}
      <div class="hp-tp" id="hp-tp-host">${titlesStep(x)}</div>
      <div id="hp-tp-after">${titlesAfter(x)}</div>
      ${email}
      <div class="field"><label for="hp-why">${own2() ? 'What you think, and why' : `${x.mode === 'intro' ? 'Why these issues matter to you' : 'Why it matters to you'} <span class="hp-opt">(optional)</span>`}</label>
        <textarea id="hp-why" name="why" rows="3" placeholder="${own2() ? 'I think… because…' : esc(storyAsk(!!x.b))}" aria-describedby="hp-why-help" autocapitalize="sentences"${x.errs.why ? ' aria-invalid="true"' : ''}>${esc(x.why)}</textarea>${x.errs.why ? errHTML('why') : ''}
        <span class="help" id="hp-why-help">${whyHelp(x)}</span>
        ${x.offer && !x.why.trim() ? `<p class="hp-offer">${btn(`Use your story about “${topicName(x.offer.topic)}”`, { kind: 'text', sm: true, icon: 'user', cls: 'hp-inl', attrs: { 'data-hp': 'usestory' } })}</p>` : ''}
        ${hasProfile() ? `<label class="check hp-savest" for="hp-savestory"><input type="checkbox" id="hp-savestory"${x.saveStory ? ' checked' : ''}><span>Save this to my profile${topicOf(x) ? ` as my story about “${esc(topicName(topicOf(x)))}”` : ' as my story'}, ready for my next ${isMail(x) ? 'email' : 'letter'}</span></label>
          <span class="help hp-savelen" id="hp-savelen">${x.why.trim().length > 600 ? 'Your profile keeps the first 600 characters.' : ''}</span>` : ''}</div>
      <div class="field"><label for="hp-closing">How you’d like to sign off <span class="hp-opt">(optional)</span></label>
        <input id="hp-closing" name="closing" type="text" autocomplete="off" autocapitalize="sentences" enterkeyhint="done" placeholder="Mahalo" value="${esc(x.closing)}" aria-describedby="hp-closing-help">
        <div class="hp-sugs" role="group" aria-label="Ideas for signing off">${CLOSINGS.map(c => `<button type="button" class="chip hp-sug" data-hp="closing" data-v="${esc(c)}" aria-pressed="${x.closing.trim() === c}">${esc(c)}</button>`).join('')}</div>
        <span class="help" id="hp-closing-help">Your name goes under it.</span></div>
    </form>`;
}
// Under the "why" box: where its words came from (their saved story, R-147; by topic since R-156), else what it is for.
function whyHelp(x) {
  const saved = x.whyStory && storyFor(catsOf(x.mode === 'intro' ? null : x.b));
  if (saved && x.why.trim() === saved.text) return `${icon('user')} Your story${saved.topic && topicName(saved.topic) ? ` about “${esc(topicName(saved.topic))}”` : ''}, from your profile. Change it to fit this bill.`;
  return own2() ? `This is the heart of your ${isMail(x) ? 'email' : 'letter'}. One or two sentences in your own words.` : 'One or two sentences. A personal reason carries the most weight.';
}
// Ideas, never filled in for them (Nate 9/28): a tap puts one in the box, where they can change it. Short and plain, the
// same for testimony and emails (Nate 10/5, R-157: "much simpler. mahalo, thank you, sincerely, etc.").
const CLOSINGS = ['Mahalo', 'Thank you', 'Sincerely', 'Respectfully', 'Aloha'];
const ERR = { name: 'Enter your name', email: 'Enter an email like name@example.com', why: 'Say what you think in a sentence or two' };
// The letter is the person's own (their stance differs from HIPHI's, or they have comments): their reason is the letter.
const own2 = () => { const x = S.helper; return !!x && !!x.b && !sameAsHiphi(x.b, x.stance || hiphiStance(x.b)); };
const own2For = (b, stance) => !sameAsHiphi(b, stance);
const HELP = { email: 'hp-email-help' };   // fields whose help text stays described while an error shows
const errHTML = f => `<span class="err" id="hp-${f}-err">${icon('triangle-alert')}${ERR[f]}</span>`;
function lateBanner(h, { email = true } = {}) {
  const t = h.testimony_deadline;
  return `<div class="notice warn hp-late">${icon('triangle-alert')}<div><p>The deadline for written testimony passed ${esc(pastDay(t))} at ${esc(timeWord(t))}. You can still send it. It will be marked late and may not be read before the vote.${email ? ' A short email to the chair is the quickest way to be heard today.' : ''}</p>
    ${email ? btn('Email the chair instead', { kind: 'text', icon: 'mail', cls: 'hp-inl', attrs: { 'data-hp': 'email' } }) : ''}</div></div>`;
}

// Screen 2: the letter, ready to copy. Lato 16px in a box that grows with the text (no inner scrolling on a phone).
function letterScreen() {
  if (isMail(S.helper)) return mailLetterScreen();
  const x = S.helper, file = `${x.b.bill_number}-testimony.txt`;
  const again = againNotes(x);
  return `<div class="hp-top">${screenHead(2, 'Your letter')}
      <p class="hp-sub" id="hp-lsub">${x.again && !x.update ? `Your ${x.again.rec.at ? `${esc(shortDay(x.again.rec.at))} ` : ''}letter, addressed to this hearing’s committee, chairs and date. Read it over and change anything you like.` : 'We wrote it from your answers. Read it over, and make the first line your own: lawmakers notice letters in people’s own words.'}</p></div>
    ${welcomeBack()}
    ${again}
    ${x.stale ? `<div class="notice info">${icon('info')}<div><p>You changed your details after editing this letter.</p>${btn('Use my new details', { kind: 'text', icon: 'rotate-ccw', cls: 'hp-inl', attrs: { 'data-hp': 'rewrite' } })}</div></div>` : ''}
    <textarea id="hp-letter" class="hp-letter" aria-labelledby="hp-sh" aria-describedby="hp-lsub" spellcheck="true" autocapitalize="sentences" rows="14">${esc(x.letter)}</textarea>
    ${saysBox(x)}
    ${x.copyFail ? `<div class="inlinemsg" role="alert">${icon('circle-alert')}<span>We couldn’t copy it for you. Your letter is selected: choose Copy, or select all of it and copy it yourself.</span></div>` : ''}
    <div class="hp-under">${btn('Copy', { kind: 'text', icon: 'copy', attrs: { 'data-hp': 'copy', id: 'hp-cp' } })}${x.copyChip ? `<span class="okmsg">${icon('check')}Copied</span>` : ''}
      <a class="btn text" href="${esc(selfMail(x))}" data-hp="selfmail">${icon('mail')}<span>Email it to myself</span></a>
      ${btn('Download as a file', { kind: 'text', icon: 'download', attrs: { 'data-hp': 'download', id: 'hp-dl' } })}
      ${x.saved ? `<span class="okmsg">${icon('check')}Saved as ${esc(file)}</span>` : ''}</div>
    ${forgetLink(x)}`;
}
// What the letter says about the person (R-156 B2), above the words: their titles, where they live, their story, each a
// tap to leave out. Testimony is posted publicly in Hawaiʻi, so they decide what goes; and a nudge to make the first line
// their own, since the same first line in many letters reads as form mail (CMF).
const isMineLeg = l => { const d = myDistricts(); return !!d && !!l && ((l.chamber === 'S' && +l.district === +d.senate) || (l.chamber === 'H' && +l.district === +d.house)); };
function saysBox(x) {
  if (x.remind) return '';
  const all = titlesOf(x), parts = [];
  const usual = x.b ? pickTitle(all, aboutBill(x.b)) : all.slice(0, 1), two = twoFor(x);
  if (all.length) parts.push(['titles', asWords(two.length ? two : usual), two.length > 0]);
  if (isMail(x) ? x.mode === 'email' && x.to.some(t => isMineLeg(t.leg)) : !!liveLine(x.h)) parts.push(['live', isMail(x) ? 'You live in their district' : liveLine(x.h).replace(/\.$/, ''), !x.noLive]);
  const saved = [myStory(), ...Object.values(myStories())].includes(x.why.trim());
  if (x.why.trim() && !own2()) parts.push(['why', saved ? 'Your story' : 'Your reason', !x.noWhy]);
  if (!parts.length) return '';
  // A part left out says so, with a plus to put it back (the review: a plain outline read as still in).
  const out = parts.some(([, , on]) => !on);
  return `<div class="hp-says" role="group" aria-labelledby="hp-says-t"><p class="hp-says-t" id="hp-says-t">About you, in this ${isMail(x) ? 'email' : 'letter'}</p>
    <div class="chips">${parts.map(([k, l, on]) => `<button type="button" class="chip tp-c${on ? '' : ' hp-out'}" id="hp-says-${k}" data-hp="says" data-v="${k}" aria-pressed="${on}">${icon(on ? 'check' : 'plus')}<span>${esc(l)}${on ? '' : ' · left out'}</span></button>`).join('')}</div>
    <p class="small muted">${isMail(x) ? '' : 'Testimony is posted publicly. '}${out ? 'Tap one to put it back.' : 'Tap one to leave it out.'}</p></div>`;
}
// Delete the kept letter or email this one started from (B-5: with Undo), under the words.
const forgetLink = x => x.again ? `<div class="hp-forget">${btn(`Delete this saved ${savedWord(x.again)}`, { kind: 'text', sm: true, icon: 'trash-2', cls: 'hp-quietbtn', attrs: { 'data-hp': 'again-forget' } })}</div>` : '';
// A letter or email sent again (R-148, R-153): what changed, HIPHI's advice, and any words still about the old step.
function againNotes(x) {
  const c = x.again && x.check, what = isMail(x) ? 'email' : 'letter';
  return !x.again ? '' : [
    c && c.level === 'big' ? `<div class="notice warn">${icon('triangle-alert')}<div><p class="strong">Before you send, check your ${what}:</p><ul class="hp-why-list" role="list">${bigWords(c, x.b, { adviceOnly: true })}</ul></div></div>`
      : c && c.level === 'changed' && c.since.length ? notice('info', 'info', `Check it against the bill as it is now. ${draftName(c.since[c.since.length - 1].version)}: ${c.since[c.since.length - 1].summary}`)
      : '',
    x.mentions?.length ? notice('info', 'calendar', `Your ${what} mentions “${x.mentions.join('” and “')}”. ${x.h ? `This hearing is on ${dateLong(x.h.scheduled_at)}` : 'That was the earlier step'}: change it if it’s about the earlier one.`) : '',
    x.askMissing ? notice('info', 'info', `Check the end of your email. For this step it should ask: “${x.askMissing}”`) : '',
  ].join('');
}

// The email, ready to read over (R-079): who it goes to, a subject they can change, and the message. Sending is the next step.
const toList = x => x.to.map(t => `<li><span class="hp-toname">${esc(t.label)}</span><span class="hp-torole">${esc(t.role)}</span>
    ${t.email ? `<span class="hp-toaddr">${esc(t.email)}</span>` : `<span class="hp-toaddr">No email address listed. ${t.url ? `<a href="${esc(t.url)}" target="_blank" rel="noopener">See their Capitol page</a>` : ''}</span>`}</li>`).join('');
function mailLetterScreen() {
  const x = S.helper;
  const lsub = x.remind ? `${spaced(x.b.bill_number)} still has no hearing${hearingBy(x.b) ? `, and ${hearingBy(x.b)} is the last day for one` : ''}. Here’s a short follow-up${x.remindOf ? ` to your ${shortDay(x.remindOf)} email` : ''}. Change anything you like.`
    : x.again && !x.update ? 'Read it over and change anything you like.'
    : 'We wrote it from your answers. Read it over, and make the first line your own: lawmakers notice emails in people’s own words.';
  return `<div class="hp-top">${screenHead(2, x.remind ? 'Your follow-up' : 'Your email')}
      <p class="hp-sub" id="hp-lsub">${lsub}</p></div>
    ${welcomeBack()}
    ${againNotes(x)}
    ${x.stale ? `<div class="notice info">${icon('info')}<div><p>You changed your details after editing this email.</p>${btn('Use my new details', { kind: 'text', icon: 'rotate-ccw', cls: 'hp-inl', attrs: { 'data-hp': 'rewrite' } })}</div></div>` : ''}
    <div class="hp-to"><p class="hp-knh" id="hp-toh">To</p><ul class="hp-tol" role="list" aria-labelledby="hp-toh">${toList(x)}</ul></div>
    <div class="field"><label for="hp-subject">Subject</label><input id="hp-subject" name="subject" type="text" autocomplete="off" autocapitalize="sentences" value="${esc(x.subject)}"></div>
    <div class="field hp-msgf"><label for="hp-letter">Message</label>
      <textarea id="hp-letter" class="hp-letter hp-mailbody" aria-describedby="hp-lsub" spellcheck="true" autocapitalize="sentences" rows="12">${esc(x.letter)}</textarea></div>
    ${saysBox(x)}
    ${x.copyFail ? `<div class="inlinemsg" role="alert">${icon('circle-alert')}<span>We couldn’t copy it for you. Your message is selected: choose Copy, or select all of it and copy it yourself.</span></div>` : ''}
    <div class="hp-under">${btn('Copy message', { kind: 'text', icon: 'copy', attrs: { 'data-hp': 'copy', id: 'hp-cp' } })}${x.copyChip ? `<span class="okmsg">${icon('check')}Copied</span>` : ''}</div>
    ${forgetLink(x)}`;
}

// Sending (R-079). One screen, no question first: the message is already on the clipboard (goTo), and each button opens
// a new email with the address, subject and message filled in. The first button is the likeliest one for this device.
// Once one is chosen, "Did you send it?" takes over the heading and the footer, like the green box for testimony.
const SEND = {
  app: { label: 'Open in my mail app', sub: '' },
  gmail: { label: 'Open in Gmail', sub: 'Opens in a new tab' },
  // outlook.live.com's compose link is for Outlook.com and Hotmail accounts; a work account's Outlook does not take it.
  outlook: { label: 'Open in Outlook.com', sub: 'For Outlook.com and Hotmail, in a new tab' },
};
function mailScreen() {
  const x = S.helper, L = sendLinks(x), order = onPhone() ? ['app', 'gmail', 'outlook'] : ['gmail', 'outlook', 'app'];
  const noAddr = !x.to.some(t => t.email);
  const send = (via, i) => { const l = L[via], main = i === 0 && !x.asked, s = SEND[via];
    return `<li><a class="btn ${main ? 'primary' : 'secondary'} full hp-send" href="${esc(l.href)}" data-hp="send" data-via="${via}"${via === 'app' ? '' : ' target="_blank" rel="noopener"'}>
      ${icon(via === 'app' ? 'mail' : 'at-sign')}<span>${s.label}</span>${via === 'app' ? '' : icon('external-link', { cls: 'hp-ext' })}</a>
      ${s.sub || l.cut ? `<p class="hp-sendsub">${esc([s.sub, l.cut ? 'Your message is long: paste it in.' : ''].filter(Boolean).join('. '))}</p>` : ''}</li>`; };
  const trouble = x.trouble ? `<div class="notice warn hp-trouble">${icon('circle-help')}<div>
      <p><b>Nothing opened?</b> Try another button, or copy the address and message below into any email.</p>
      <p><b>The message was missing or cut short?</b> ${x.autoCopied ? 'It’s copied: paste it into the email.' : 'Choose Copy message below, then paste it into the email.'}</p>
      ${x.to.find(t => t.phone) ? `<p><b>Rather call?</b> ${esc(shortName(x.to.find(t => t.phone)))}’s office: <a class="hp-tel" href="tel:${esc(String(x.to.find(t => t.phone).phone).replace(/[^\d+]/g, ''))}">${esc(x.to.find(t => t.phone).phone)}</a></p>` : ''}
      <p><b>Still stuck?</b> The Public Access Room helps for free: <a class="hp-tel" href="${PAR_TEL}">${PAR_SHOW}</a>.</p></div></div>` : '';
  const copies = `<div class="hp-other"><p class="hp-knh">Use another email service?</p><p class="small">Copy each part and paste it in.</p>
      <div class="hp-under hp-copies">${btn('Copy address', { kind: 'text', sm: true, icon: 'at-sign', attrs: { 'data-hp': 'copypart', 'data-part': 'to' } })}
        ${btn('Copy subject', { kind: 'text', sm: true, icon: 'copy', attrs: { 'data-hp': 'copypart', 'data-part': 'subject' } })}
        ${btn('Copy message', { kind: 'text', sm: true, icon: 'copy', attrs: { 'data-hp': 'copypart', 'data-part': 'body' } })}
        ${x.partChip ? `<span class="okmsg" role="status">${icon('check')}${esc(x.partChip)}</span>` : ''}</div></div>`;
  return `<div class="hp-top">${screenHead(3, x.asked ? 'Did you send it?' : 'Send your email')}
      <p class="hp-sub">${x.asked ? 'If your email went, choose Yes, I sent it. Not sure? Look in your Sent folder.'
        : `${x.autoCopied ? 'Your message is copied, just in case. ' : ''}Choose where you write email. Each one opens a new email with everything filled in.`}</p></div>
    ${trouble}
    ${welcomeBack()}
    ${noAddr ? `${notice('warn', 'triangle-alert', 'We don’t have an email address for them. Their Capitol page says how to reach them.')}
      ${x.to.filter(t => t.url).map(t => btn(esc(`${shortName(t)} on the Capitol website`), { kind: 'secondary', iconEnd: 'external-link', full: true, href: t.url, attrs: { target: '_blank', rel: 'noopener' } })).join('')}`
      : `<ul class="hp-sends" role="list">${order.map(send).join('')}</ul>`}
    ${copies}
    ${x.failMsg ? `<div class="inlinemsg" role="alert">${icon('circle-alert')}<span>${esc(x.failMsg)}</span></div>` : ''}`;
}

// A copy that survives any browser: their own mail app, addressed to nobody, the letter as the body (R-068).
const selfMail = x => `mailto:?subject=${encodeURIComponent(`My testimony on ${spaced(x.b.bill_number)}`)}&body=${encodeURIComponent(x.letter)}`;

// The Capitol account, once (R-068): the hardest part for a first-timer was one line in a list they had to remember on
// another website. Asked once per browser; "yes" is remembered (hiphi_me.capitolAcct) and the step never shows again.
function acctScreen() {
  const x = S.helper;
  if (!x.acctNew) return `<div class="hp-top">${screenHead(0, 'Your Capitol account')}
      <p class="hp-sub">Testimony is sent on the Legislature’s website, with a free account there.</p></div>
    <div class="hp-choices" role="group" aria-label="Have you sent testimony on the Capitol website before?">
      <p class="hp-q">Have you sent testimony on the Capitol website before?</p>
      <button type="button" class="hp-choice" data-hp="acct-yes"><b>Yes, I have an account</b></button>
      <button type="button" class="hp-choice" data-hp="acct-no"><b>No, this is my first time</b><span>We’ll help you make one. It takes a few minutes.</span></button></div>`;
  const steps = ['<p>Open the Capitol page. Choose <b>Submit Testimony</b>, then <b>Register</b>.</p>',
    '<p>Enter your name, your email and a new password.</p>',
    '<p>They email you a link. Open it to confirm. Check spam if it doesn’t come.</p>',
    '<p>Come back here. <b>Your letter is saved.</b></p>'];
  return `<div class="hp-top">${screenHead(0, 'Make your free Capitol account')}
      <p class="hp-sub">You need your email and a new password. You only do this once.</p></div>
    ${stepList(steps)}
    ${x.acctHelp ? `<div class="notice info">${icon('info')}<div><p><b>The email hasn’t come?</b> It can take a few minutes. Look in spam or promotions. Still nothing? The Public Access Room helps for free: <a class="hp-tel" href="${PAR_TEL}">${PAR_SHOW}</a>.</p></div></div>` : ''}
    ${capitolNotes(true)}`;
}

// Screen 3: the Capitol's own steps, in the words its form uses (PAR "How to Submit Testimony", 2026).
// The Capitol form's first two steps are the same for everyone; the rest depends on whose words go in the box.
const CAPITOL_LOGIN = '<p>Log in, or make a free account. They email you a link to confirm. Do that first, then come back to the bill.</p>';
const pickHearing = h => `<p>Choose <b>Submit Testimony</b> and pick the hearing on <b class="hp-nw">${esc(dateLong(h.scheduled_at))}</b>.</p>`;
// Someone who said "I'd testify in person" (their profile, R-156 C1) is told to pick In person; everyone else Written.
const inPerson = () => myInterests().includes('testify');
const formChoices = word => inPerson() ? `<p>Choose: <b>${word}</b> · <b>Individual</b> · <b>In person</b>, since you said you’d testify in person. Rather not this time? Pick <b>Written testimony only</b>.</p>`
  : `<p>Choose: <b>${word}</b> · <b>Individual</b> · <b>Written testimony only</b>. Want to speak? Pick <b>In person</b> or <b>Zoom</b> instead.</p>`;
const stepList = steps => `<ol class="card hp-steps" role="list">${steps.map((s, i) => `<li><span class="hp-n">${i + 1}</span><div class="hp-stxt">${s}</div></li>`).join('')}</ol>`;
const capitolNotes = saved => `<div class="hp-notes">
    <p class="note">${icon('clock')}<span>The Capitol site logs you out after 60 minutes.${saved ? ' Your letter stays saved here.' : ''}</span></p>
    <p class="note">${icon('phone')}<span>Stuck? The Public Access Room helps for free: <a class="hp-tel" href="${PAR_TEL}">${PAR_SHOW}</a></span></p>
  </div>`;
const capitolLink = (b, h, label, o = {}) => btn(label, { iconEnd: 'external-link', href: capitolUrl(b, h), ...o, attrs: { target: '_blank', rel: 'noopener', 'data-hp': 'capitol' } });
function sendScreen() {
  const x = S.helper, { b, h } = x;
  // "Open the Capitol page" is the footer's main button, so the checklist does not repeat it (assessment, 9/19).
  // Once the footer has turned into "I saw the green box", step 1 offers the way back for a tab closed by mistake.
  const steps = [
    `<p>Log in to the Capitol website${x.acctStep ? ' with the account you just made' : ''}.</p>${x.back ? capitolLink(b, h, 'Open the Capitol page again', { kind: 'text', sm: true, cls: 'hp-inl' }) : ''}`,
    pickHearing(h), formChoices(formWord(x.stance || hiphiStance(b))),
    `<p>Paste your letter${x.saved ? ' (or upload the file)' : ''} and submit. Look for the <b>green box</b>. That means it worked.</p>
      ${x.copied3 ? `<span class="chip ok" id="hp-copy3" tabindex="-1">${icon('check')}Copied</span>` : btn('Copy my letter again', { kind: 'text', sm: true, icon: 'copy', cls: 'hp-inl', attrs: { 'data-hp': 'copy', id: 'hp-copy3' } })}`,
  ];
  const trouble = x.trouble ? `<div class="notice warn hp-trouble">${icon('life-buoy')}<div>
      <p><b>Logged out?</b> Log in again. Your letter is still here: choose Copy my letter again.</p>
      <p><b>Can’t find the hearing?</b> The Public Access Room can help: <a class="hp-tel" href="${PAR_TEL}">${PAR_SHOW}</a>.</p>
      <p><b>Past the deadline?</b> You can still send it. It will be marked late.</p></div></div>` : '';
  return `<div class="hp-top">${screenHead(3, x.back ? 'Did you see the green box?' : 'Send it at the Capitol')}
      <p class="hp-sub">${x.back ? 'The green box on the Capitol page means your testimony went through.' : 'One tap copies your letter and opens the Capitol page. Follow these steps there. We’ll be right here when you come back.'}</p></div>
    ${trouble}
    ${welcomeBack()}
    ${stepList(steps)}
    ${capitolNotes(true)}
    ${x.failMsg ? `<div class="inlinemsg" role="alert">${icon('circle-alert')}<span>${esc(x.failMsg)}</span></div>` : ''}`;
}

// Confirmation: the reward is what happens next, not points (plan section 1).
function doneScreen() {
  const x = S.helper, { b, h } = x, n = spaced(b.bill_number), first = x.name.trim().split(/\s+/)[0];
  const held = new Date(h.scheduled_at) < Date.now(), plural = codesOf(h.committee).length > 1;
  const when = `${dateLong(h.scheduled_at)} at ${timeWord(h.scheduled_at)}`;
  const next = held ? `The ${cmteLabel(h.committee)} heard it ${when}.` : `The ${cmteLabel(h.committee)} ${plural ? 'hear' : 'hears'} it ${when}.`;
  const v = streamOf(h), miles = newMilestones(x.before);
  const watch = v ? `<a class="btn text hp-watch" href="${esc(v.url)}" target="_blank" rel="noopener">${icon('play')}<span>${v.state === 'live' ? 'Watch live now' : v.state === 'after' ? 'Watch the recording' : 'Watch it live on YouTube'}</span>${icon('external-link')}</a>` : '';
  const ask = emailAsk(x);
  return `<div class="hp-hero">
      <div class="hp-badge" aria-hidden="true">${flower(56)}</div>
      <h2 class="hp-mahalo" id="hp-done-t" tabindex="-1">${first ? `Mahalo, ${esc(first)}!` : 'Mahalo!'}</h2>
      <p class="hp-lede">You sent testimony on ${esc(n)}. The committee reads it before they vote, and it becomes part of the public record.</p>
      ${miles.length ? `<div class="chips hp-miles" aria-label="Milestones you just earned">${miles.map(m => `<span class="chip yay">${flower(16)}${esc(m)}</span>`).join('')}</div>` : ''}
    </div>
    <section class="card hp-next" aria-labelledby="hp-next-t"><h3 id="hp-next-t">What happens next</h3>
      <p>${esc(next)} ${followWords(x, n)}</p>
      ${held ? '' : goingLine(x)}
      ${x.followedIssue ? btn('Don’t follow it', { kind: 'text', sm: true, cls: 'hp-inl', attrs: { 'data-hp': 'unfollow' } }) : ''}
      ${watch}</section>
    ${storyCard(x)}${profileLine(x)}
    ${ask}`;
}
// Going in person (R-142, Nate 10/4: directions for people who sign up for a hearing in person). Someone who said they'd
// testify in person is shown where and when; anyone else is asked once in a line. "I plan to go" is the card's own
// sign-up, and the directions then open here: the card's list (goDirections), with its calendar file.
function goingLine(x) {
  const { b, h } = x;
  if (didKind(b, h, 'attend')) return `<p class="okmsg hp-going">${icon('circle-check')}<span>You plan to go. Mahalo!</span></p>${goDirections(b, h, { hp: true })}`;
  const go = btn('I plan to go', { kind: 'secondary', sm: true, icon: 'map-pin', attrs: { 'data-hp': 'going' } });
  return inPerson() ? `<p>${icon('map-pin')} To speak in person: Hawaiʻi State Capitol, ${esc(roomFloor(h))}. Tap <b>I plan to go</b>, and you get directions.</p><div class="btnrow">${go}</div>`
    : `<div class="hp-goask"><p>Going to the hearing in person?</p>${go}</div>`;
}
// After a letter is sent (R-156 B3): someone with a profile and no story for this topic is asked for one sentence, with
// the topic's guiding question and their letter's reason ready in the box. Once per topic ("No thanks" is kept).
function storyCard(x) {
  const t = topicOf(x);
  if (x.askStory === 'saved') return `<p class="okmsg hp-saved">${icon('circle-check')}<span>Saved in your profile as your story${t ? ` about “${esc(topicName(t))}”` : ''}.</span></p>`;
  if (!x.askStory) return '';
  return `<section class="card hp-storyask" aria-labelledby="hp-sa-t"><h3 id="hp-sa-t">Save a sentence on why this matters to you?</h3>
    <div class="field"><label for="hp-sa">${esc(storyAsk(!!x.b))}</label>
      <textarea id="hp-sa" rows="3" maxlength="600" autocapitalize="sentences" aria-describedby="hp-sa-h">${esc(x.storyDraft || '')}</textarea>
      <span class="help" id="hp-sa-h">${esc(STORY_HINT)} We’ll put it in your next ${isMail(x) ? 'emails' : 'letters'}${t ? ` about “${esc(topicName(t))}”` : ''}, and you can change it each time. HIPHI staff can see it.</span></div>
    <div id="hp-sa-msg"></div>
    <div class="btnrow">${btn('Save to my profile', { kind: 'secondary', sm: true, icon: 'check', attrs: { 'data-hp': 'storysave' } })}${btn('No thanks', { kind: 'text', sm: true, attrs: { 'data-hp': 'storyno' } })}</div></section>`;
}
// The profile, named once after a letter (R-156 C2): what was kept and where it is. Decided at the send (x.tellProfile).
function profileLine(x) {
  if (!x.tellProfile) return '';
  const bits = [x.name.trim() ? 'name' : '', titlesOf(x).length ? 'titles' : '', x.storySaved || x.askStory === 'saved' ? 'story' : ''].filter(Boolean);
  if (!bits.length) return '';
  return `<p class="hp-profline">${icon('user')}<span>Your ${andList(bits)} ${bits.length > 1 ? 'are' : 'is'} saved in your profile, ready for next time.</span>${btn('See your profile', { kind: 'text', sm: true, cls: 'hp-inl', attrs: { 'data-hp': 'toprofile' } })}</p>`;
}
// Decided once, when the letter is sent: the story ask and the profile line, and the kind-only counts (E1).
function afterSend(x) {
  const t = topicOf(x), me = loadMe();
  x.askStory = hasProfile() && !x.remind && !x.storySaved && !storyFor(catsOf(x.mode === 'intro' ? null : x.b)) && !(me.storyNo || []).includes(t || 'any') ? 'ask' : null;
  x.storyDraft = x.noWhy || own2() ? '' : x.why.trim().slice(0, 600);
  x.tellProfile = hasProfile() && !me.toldProfile; if (x.tellProfile) saveMe({ toldProfile: true });
  const two = twoFor(x), L = x.letter || '';
  if (two.length && L.includes(aWords(two))) app.onAct?.('letter_titled');
  if ([myStory(), ...Object.values(myStories())].filter(Boolean).some(st => L.includes(st))) app.onAct?.('letter_story');
}
const followWords = (x, n) => x.followedIssue ? `We now follow “${esc(x.followedIssue.name)}” for you, so you’ll see what they decide.` : x.followedNow ? `We added ${esc(n)} to My issues, so you’ll see what they decide.` : 'We’ll show what they decide in My issues.';
// Someone who gave their email on the About you step has been asked already: they see where to finish, never a second
// ask. Everyone else who is signed out gets the one email ask (plan 2.9), with its ids renamed so they never clash
// with a copy on the page behind. A link that could not be sent is one quiet line with a way to try again.
function emailAsk(x) {
  const gave = !S.session && x.link && x.linkTo;
  return gave && x.link !== 'failed' ? `<div class="card tint hp-inbox" id="hp-inbox" tabindex="-1" role="status">${icon('mail-check')}<div>
        <p class="strong">Check your inbox at <span class="hp-break">${esc(x.linkTo)}</span> to finish</p>
        <p class="small">Open the link on this device and your issues come with you. Hearing alerts start once you do.</p>
        ${x.linkDemo || DEMO ? '<p class="small muted">This is the sandbox, so no email was sent.</p>' : ''}</div></div>`
    : gave ? `<div class="hp-linkfail"><p class="hp-quiet" role="status">${icon('info')}<span>We couldn’t send your link to <span class="hp-break">${esc(x.linkTo)}</span> just now. Your testimony is not affected.</span></p>
        ${btn('Try sending it again', { kind: 'text', sm: true, icon: 'rotate-ccw', cls: 'hp-inl', attrs: { 'data-hp': 'relink', id: 'hp-relink' } })}</div>`
    : S.nudge && x.askStory !== 'ask' ? nudgeCard('action', 'hp-ng') : '';   // one ask on the Mahalo, never two (R-156)
}
// The Mahalo for an email (R-079): what they did, in words, and what happens next.
function mailDoneScreen() {
  const x = S.helper, { b, h } = x, first = x.name.trim().split(/\s+/)[0], names = andList(x.to.map(shortName)), miles = newMilestones(x.before);
  const n = b ? spaced(b.bill_number) : '', stance = x.stance || (b ? hiphiStance(b) : ''), m = x.moment || {};
  const lede = x.mode === 'intro' ? `You introduced yourself to ${names}. When a bill on your issues comes up, they’ll know who is writing.`
    : x.remind ? `You followed up with ${names} about ${n} before its deadline.`
    : x.mode === 'legislators' ? `You wrote to ${names} about ${n}. Lawmakers listen closest to the people they represent.`
    : h ? `You emailed ${names} about ${n}. Chairs read what people send them before the committee votes.`
    : stance === 'oppose' ? `You asked ${names} not to schedule ${n}. The chair decides which bills get a hearing.`
    : stance === 'support' ? `You asked ${names} to give ${n} a hearing. The chair decides which bills get one, and a polite ask helps.`
    : `You sent ${names} your comments on ${n}. The chair decides which bills get a hearing.`;
  const held = h && new Date(h.scheduled_at) < Date.now(), when = h ? `${dateLong(h.scheduled_at)} at ${timeWord(h.scheduled_at)}` : '';
  const next = x.mode === 'intro' ? 'When a bill on your issues needs a voice, we’ll show you how to reach them here.'
    : h ? `${held ? `The ${cmteLabel(h.committee)} heard it ${when}.` : `The ${cmteLabel(h.committee)} ${codesOf(h.committee).length > 1 ? 'hear' : 'hears'} it ${when}.`} ${followWords(x, n)}`
    : m.kind === 'floor' ? `The full ${CHAMBER_NAME[m.chamber] || 'chamber'} votes on it soon. ${followWords(x, n)}`
    : `If it gets a hearing, you’ll see it in My issues. ${followWords(x, n)}`;
  const v = h && streamOf(h);
  const watch = v ? `<a class="btn text hp-watch" href="${esc(v.url)}" target="_blank" rel="noopener">${icon('play')}<span>${v.state === 'live' ? 'Watch live now' : v.state === 'after' ? 'Watch the recording' : 'Watch it live on YouTube'}</span>${icon('external-link')}</a>` : '';
  return `<div class="hp-hero">
      <div class="hp-badge" aria-hidden="true">${flower(56)}</div>
      <h2 class="hp-mahalo" id="hp-done-t" tabindex="-1">${first ? `Mahalo, ${esc(first)}!` : 'Mahalo!'}</h2>
      <p class="hp-lede">${esc(lede)}</p>
      ${miles.length ? `<div class="chips hp-miles" aria-label="Milestones you just earned">${miles.map(m => `<span class="chip yay">${flower(16)}${esc(m)}</span>`).join('')}</div>` : ''}
    </div>
    <section class="card hp-next" aria-labelledby="hp-next-t"><h3 id="hp-next-t">What happens next</h3>
      <p>${next}</p>
      ${x.followedIssue ? btn('Don’t follow it', { kind: 'text', sm: true, cls: 'hp-inl', attrs: { 'data-hp': 'unfollow' } }) : ''}
      ${watch}</section>
    ${storyCard(x)}${profileLine(x)}
    ${emailAsk(x)}`;
}

// The sticky footer holds the one main button of each screen. On screen 3 a second, quiet row holds the two ways out
// that used to hide below the fold or did not exist: "I already sent it" (for someone who filed in another window,
// where we never see them leave and come back) and "I'll finish later".
function foot() {
  const x = S.helper, row = (html, more = '') => `<div class="hp-footin">${html}</div>${more ? `<div class="hp-footmore">${more}</div>` : ''}`;
  const back = `<button type="button" class="btn text hp-back" data-hp="back">${icon('chevron-left')}<span>Back</span></button>`;
  const later = btn('I’ll finish later', { kind: 'text', sm: true, attrs: { 'data-hp': 'later' } });
  // The three answers are the buttons, and tapping one moves on. Someone who already answered and came Back sees their
  // answer chosen, so Next keeps it (Nate 10/5, R-167: with only Close here, the way on was to tap the chosen answer again).
  if (x.screen === 'stand') return row(btn('Close', { kind: 'text', cls: 'hp-back', attrs: { 'data-hp': 'close' } })
    + (x.stance ? btn('Next', { kind: 'primary', iconEnd: 'arrow-right', cls: 'hp-main', attrs: { 'data-hp': 'next' } }) : ''));
  // Your letter is ready (R-148): use it, or update it when the bill changed in a way that matters; a new letter either way.
  if (x.screen === 'again') {
    const fresh = btn(`Start a new ${isMail(x) ? 'email' : 'letter'}`, { kind: 'text', sm: true, attrs: { 'data-hp': 'again-new' } });
    if (!x.check) return row(`<button type="button" class="btn primary hp-main" aria-busy="true" disabled>${icon('loader-circle')}<span>Checking…</span></button>`, fresh);
    const w = isMail(x) ? 'email' : 'letter';
    return row(btn(x.check.level === 'big' ? `Check my ${w}` : `Use my ${w}`, { kind: 'primary', iconEnd: 'arrow-right', cls: 'hp-main', attrs: { 'data-hp': 'again-use' } }), fresh);
  }
  if (x.screen === 'know') return row((x.askStance || x.again ? back : '') + btn('Next', { kind: 'primary', iconEnd: 'arrow-right', cls: 'hp-main', attrs: { 'data-hp': 'next' } }));
  if (x.screen === 1) return row((seqOf(x)[0] === 1 ? '' : back) + `<button type="submit" form="hp-form" class="btn primary full hp-main"><span>${isMail(x) ? 'See my email' : 'See my letter'}</span>${icon('arrow-right')}</button>`);
  // Sending an email: the send buttons are the main choice until one is used; then "Yes, I sent it" is (A-3).
  if (x.screen === 'mail') return row(back + (x.busy ? `<button type="button" class="btn primary hp-main" aria-busy="true">${icon('loader-circle')}<span>Saving…</span></button>`
    : x.asked ? btn('Yes, I sent it', { kind: 'primary', icon: 'check', cls: 'hp-main', attrs: { 'data-hp': 'mailsent' } }) : ''),
    x.busy ? '' : (x.asked ? btn('Something went wrong', { kind: 'text', sm: true, attrs: { 'data-hp': 'trouble' } }) : btn('I already sent it', { kind: 'text', sm: true, attrs: { 'data-hp': 'mailsent' } })) + later);
  if (x.screen === 2) return row((seqOf(x)[0] === 2 ? '' : back) + btn('Next', { kind: 'primary', iconEnd: 'arrow-right', cls: 'hp-main', attrs: { 'data-hp': 'next' } }), later);   // the reminder starts here (R-153)
  if (x.screen === 'acct') return row(back + (!x.acctNew ? '' : x.acctBack ? btn('I’m signed up', { kind: 'primary', icon: 'check', cls: 'hp-main', attrs: { 'data-hp': 'acct-done' } })
    : capitolLink(x.b, x.h, 'Open the Capitol page', { kind: 'primary', cls: 'hp-main' })),
    (x.acctNew && x.acctBack ? btn('The email hasn’t come', { kind: 'text', sm: true, attrs: { 'data-hp': 'acct-help' } }) : '') + later);
  if (x.screen === 3) return row(back + (x.busy ? `<button type="button" class="btn primary hp-main" aria-busy="true">${icon('loader-circle')}<span>Saving…</span></button>`
    : x.back ? btn('Yes, I saw the green box', { kind: 'primary', icon: 'check', cls: 'hp-main', attrs: { 'data-hp': 'confirm' } })
    : btn('Copy my letter and open the Capitol page', { kind: 'primary', icon: 'copy', cls: 'hp-main', attrs: { 'data-hp': 'copyopen' } })),
    x.busy ? '' : (x.back ? btn('Something went wrong', { kind: 'text', sm: true, attrs: { 'data-hp': 'trouble' } }) : btn('I already sent it', { kind: 'text', sm: true, attrs: { 'data-hp': 'sent' } })) + later);
  return row((!x.b ? '' : x.shareChip ? `<span class="chip ok hp-chip" tabindex="-1">${icon('check')}${esc(x.shareChip)}</span>` : btn('Tell a friend', { kind: 'secondary', icon: 'share-2', attrs: { 'data-hp': 'share' } }))
    + btn('Done', { kind: 'primary', cls: 'hp-main', attrs: { 'data-hp': 'done' } }));
}

// Re-draw the dialog's content in place (the dialog itself stays open, so no flash of the page behind).
function paint({ focus, top = false } = {}) {
  if (!dlg || !S.helper) return;
  const a = document.activeElement, inDlg = !!a && dlg.contains(a), act = inDlg ? a.id : '', inFoot = inDlg && !!a.closest('.hp-foot');
  const keep = dlg.querySelector('.hp-body')?.scrollTop || 0;
  dlg.setAttribute('aria-labelledby', S.helper.screen === 'done' ? 'hp-done-t' : 'hp-title');
  dlg.innerHTML = inner(); drawnWith = outside();
  const body = dlg.querySelector('.hp-body'); body.scrollTop = top ? 0 : keep; S.helper.scrollTop = body.scrollTop;
  afterPaint();
  // Focus stays where it was: the same control by id, or the footer's main button when it was in the footer.
  const f = (focus && dlg.querySelector('#' + focus)) || (act && dlg.querySelector('#' + CSS.escape(act))) || (inFoot && dlg.querySelector('.hp-foot .hp-main'));
  if (f) f.focus({ preventScroll: true });
}
function paintFoot() {
  const f = dlg?.querySelector('.hp-foot'); if (!f || !S.helper) return;
  const had = f.contains(document.activeElement);
  f.innerHTML = foot();
  if (had) f.querySelector('.hp-main')?.focus({ preventScroll: true });
}
function afterPaint() {
  grow(dlg.querySelector('#hp-letter')); grow(dlg.querySelector('#hp-pts'));
  wireTitles();
  if (dlg.querySelector('.nudgecard')) wireNudge(dlg, { pfx: 'hp-ng', redraw: () => paint() });
}
function grow(t) { if (!t) return; t.style.height = 'auto'; t.style.height = `${t.scrollHeight + 2}px`; }
// A point tapped in goes into the box under the list (R-141: "an editable box that they can see"). On a phone the box is
// often below the fold, so the list moves up just enough to show it, never so far that the point just tapped goes off the top.
function showBox() {
  const body = dlg?.querySelector('.hp-body'), box = dlg?.querySelector('.hp-ptbox'); if (!body || !box) return;
  const vb = body.getBoundingClientRect(), need = box.getBoundingClientRect().bottom + 8 - vb.bottom; if (need <= 0) return;
  const tapped = document.activeElement?.closest?.('.hp-pt'), room = tapped ? tapped.getBoundingClientRect().top - vb.top - 8 : need;
  const by = Math.min(need, Math.max(0, room));
  if (by > 0) body.scrollBy({ top: by, behavior: reduceMotion() ? 'auto' : 'smooth' });
}
function announce(text) { const live = dlg?.querySelector('#hp-live'); if (!live) return; live.textContent = ''; setTimeout(() => { live.textContent = text; }, 40); }

// ---------------- behaviour ----------------
function toLetter() {
  const x = S.helper; if (!x || !dlg) return;
  for (const f of ['name', 'email', 'why', 'closing']) { const el = dlg.querySelector('#hp-' + f); if (el) x[f] = el.value; }
  const hasEmail = !!dlg.querySelector('#hp-email'), email = x.email.trim();
  // The email is optional, so empty is fine; something typed that is not an address is worth a word, because the
  // person expects alerts that would never come.
  const bad = [...(!x.name.trim() ? ['name'] : []), ...(hasEmail && email && !validEmail(email) ? ['email'] : []), ...(own2() && !x.why.trim() ? ['why'] : [])];
  ['name', ...(hasEmail ? ['email'] : []), 'why'].forEach(f => setErr(f, bad.includes(f)));
  if (bad.length) { dlg.querySelector('#hp-' + bad[0])?.focus(); return; }
  saveMe({ closing: x.closing.trim(), ...(x.b ? { why: x.why, whyBill: x.b.id } : { introWhy: x.why }), ...(hasEmail ? { email } : {}) });
  // The name, the titles picked here and the story are the person's (R-147): on this device, and on the account when
  // signed in; the story only when they ticked "Save this to my profile", under this bill's topic (R-156 B3). Words typed
  // in the title box but not added are kept (R-156). A failed account save never stops the letter.
  { const typed = pendingTitle(x.tp); if (typed && !x.tp.chosen.includes(typed) && x.tp.chosen.length < 10) x.tp.chosen = [...x.tp.chosen, typed];
    x.tp.q = ''; x.tp.adding = false;
    const titles = cleanTitles(x.tp?.chosen), patch = {}, t = topicOf(x), why = x.why.trim().slice(0, 600), st = myStories();
    if (x.name.trim() && (x.name.trim() !== x.name0 || x.name.trim() !== myName())) patch.name = x.name.trim();
    if (JSON.stringify(titles) !== JSON.stringify(myTitles())) patch.titles = titles;
    if (x.saveStory && why && why !== (t ? st[t] : myStory())) { if (t) patch.stories = { ...st, [t]: why }; else patch.story = why; x.storySaved = true; }
    if (Object.keys(patch).length) saveProfile(patch).catch(e => console.warn('profile:', e?.message || e)); }
  if (hasEmail && email) sendLink(x);   // in the background: the letter never waits for it
  goTo(2);
}
function setErr(f, on) {
  const x = S.helper; x.errs[f] = on;
  const inp = dlg?.querySelector('#hp-' + f); if (!inp) return;
  dlg.querySelector(`#hp-${f}-err`)?.remove();
  if (on) { inp.setAttribute('aria-invalid', 'true'); inp.insertAdjacentHTML('afterend', errHTML(f)); } else inp.removeAttribute('aria-invalid');
  const desc = [on ? `hp-${f}-err` : '', HELP[f] || ''].filter(Boolean).join(' ');
  if (desc) inp.setAttribute('aria-describedby', desc); else inp.removeAttribute('aria-describedby');
}
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* older phones, or no permission: try the old way */ }
  const was = document.activeElement;
  try {
    const ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.className = 'hp-offscreen';
    (dlg || document.body).appendChild(ta); ta.select(); const ok = document.execCommand('copy'); ta.remove(); was?.focus?.({ preventScroll: true }); return ok;
  } catch { return false; }
}
async function copyLetter() {
  const x = S.helper; if (!x) return;
  const ta = dlg?.querySelector('#hp-letter'); if (ta) x.letter = ta.value;
  const ok = await copyText(x.letter);
  if (S.helper !== x) return;
  if (x.screen === 3) {
    if (!ok) { x.failMsg = 'We couldn’t copy it for you. Go back to your letter, select all of it, then choose Copy.'; paint(); return; }
    x.copied3 = true; x.failMsg = ''; paint(); announce('Copied');
    setTimeout(() => { if (S.helper === x && x.screen === 3) { x.copied3 = false; paint(); } }, 2000);
    return;
  }
  if (!ok) { x.copyFail = true; x.copied = false; paint(); const t = dlg.querySelector('#hp-letter'); t?.focus(); t?.select(); return; }
  x.copied = true; x.copyFail = false; x.copyChip = true;
  paint(); announce('Copied');
  // "Copied" for two seconds, then the way forward.
  setTimeout(() => { if (S.helper === x && x.copyChip) { x.copyChip = false; paintFoot(); } }, 2000);
}
// One tap: copy the letter, then open the Capitol page (R-068). Both in the same tap, so the clipboard is fresh when they
// paste and the phone does not block the new tab. The copy is started, not awaited, so the tab opens inside the tap.
function copyAndOpen() {
  const x = S.helper; if (!x) return;
  const ta = dlg?.querySelector('#hp-letter'); if (ta) x.letter = ta.value;
  try { navigator.clipboard?.writeText(x.letter).catch(() => {}); } catch { /* the steps offer Copy again */ }
  window.open(capitolUrl(x.b, x.h), '_blank', 'noopener');
  x.away = true; x.copied3 = true; saveDraft(); paint();
}
function download() {
  const x = S.helper, file = `${x.b.bill_number}-testimony.txt`;
  const url = URL.createObjectURL(new Blob([x.letter.replace(/\r?\n/g, '\r\n')], { type: 'text/plain;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = file; (dlg || document.body).appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  x.saved = true; paint(); announce(`Saved as ${file}`);
}
async function confirmSent() {
  const x = S.helper; if (!x || x.busy) return;
  x.busy = true; x.failMsg = ''; paintFoot();
  x.before = earned();   // [key, label] pairs; newMilestones() compares by key
  try { x.first = !!(await markDone(x.b.id, x.h.id, 'testimony', true, { quiet: true }))?.firstTestimony; }
  catch (e) { x.busy = false; x.failMsg = friendly(e); paint(); return; }
  // Kept for the bill's next hearing, here and with the account (R-148). A letter sent again is counted as such too.
  try { keepLetter(recOf(x)); } catch { /* the testimony counts either way */ }
  if (x.again) app.onAct?.('again_sent');
  // Following is how they see what the committee decides: the bill's issue, as everywhere else (R-067), with "Don't
  // follow it" on the confirmation; a bill with no issue is followed on its own. A failure must not undo the testimony.
  const iss = issuesOf(x.b)[0];
  try {
    if (iss && !issueFollowed(iss)) { if (await setFollows({ issuesOn: [iss.id] }) !== false) x.followedIssue = iss; }
    else if (!iss && !S.watch.has(x.b.id)) { await toggleWatch(x.b.id); x.followedNow = S.watch.has(x.b.id); }
  } catch { /* following is a bonus */ }
  if (S.helper !== x) return;
  afterSend(x);
  x.busy = false; x.screen = 'done'; saveDraft();
  paint({ focus: 'hp-done-t', top: true });
  x.askShown = !!S.nudge;
  if (x.first) requestAnimationFrame(burst);
}
// First testimony ever: 16 hibiscus burst from behind the title over 900 ms, once, never with reduce-motion.
// Inside the dialog, because a modal dialog sits above everything else on the page.
function burst() {
  if (reduceMotion() || !dlg) return;
  const t = dlg.querySelector('#hp-done-t'); if (!t) return;
  const r = t.getBoundingClientRect(), box = document.createElement('div');
  box.className = 'burst'; box.setAttribute('aria-hidden', 'true');
  box.style.left = `${Math.round(r.left + r.width / 2)}px`; box.style.top = `${Math.round(r.top + r.height / 2)}px`;
  box.innerHTML = Array.from({ length: 16 }, (_, i) => {
    const a = i / 16 * Math.PI * 2 + (i % 2) * 0.2, d = 96 + (i % 4) * 30, size = 28 + (i * 5) % 13, delay = (i % 4) * 30, off = 16 - size / 2;
    return `<span class="fl" style="--x:${Math.round(Math.cos(a) * d)}px;--y:${Math.round(Math.sin(a) * d * 0.8)}px;--r:${(i % 2 ? 1 : -1) * (90 + i * 12)}deg;margin:${off}px 0 0 ${off}px;animation-delay:${delay}ms;animation-duration:${900 - delay}ms">${flower(size, i % 2 ? '#F28CA0' : 'var(--o400)')}</span>`;
  }).join('');
  dlg.appendChild(box);
  setTimeout(() => box.remove(), 1100);
}
async function tellFriend() {
  const x = S.helper, t = shareFor(x.b, x.h, { acted: true });
  const r = await doShare(t);   // the bill's own share page, the deadline in the words, the link once (R-113)
  let how = r === 'shared' ? 'Shared. Mahalo!' : r === 'copied' ? 'Link copied' : '';
  if (!how && !navigator.share && await copyText(t.copy)) how = 'Link copied';   // older browsers: the hidden-field copy
  if (!how || S.helper !== x) return;
  // A share counts as an action (plan 7, "every action counts").
  if (!didKind(x.b, x.h, 'share')) await markDone(x.b.id, x.h?.id || '', 'share', true, { quiet: true });
  x.shareChip = how; paint(); dlg?.querySelector('.hp-foot .hp-chip')?.focus({ preventScroll: true }); announce(how);
  setTimeout(() => { if (S.helper === x) { x.shareChip = ''; paintFoot(); } }, 2500);
}
function finishLater() { const x = S.helper; x.toast = `Saved. Your ${isMail(x) ? 'email' : 'letter'} will be here when you come back.`; requestClose(); }
// Late testimony: "Email the chair instead" closes this walkthrough and opens the email one on the same hearing, with
// where they stand and the points they picked carried over (R-079).
function emailInstead() {
  const x = S.helper, o = { mode: 'email', bill: x.b.id, hearing: x.h.id, stance: x.stance, points: x.points, pointsText: x.pointsText };
  afterClose = () => openMail(o);
  requestClose();
}
// "Yes, I sent it" (or "I already sent it"): counted exactly as the quick email was - an 'email' action, on the hearing
// when there is one, else on the bill, so counts, milestones and "You emailed the chair" rows keep working. Asking a
// chair for a hearing also leaves the per-committee mark (core askMark) so that ask is not offered again; a moment with
// the person's own legislator leaves its own mark. The introduction has no bill: it is counted by kind only (visitlog)
// and remembered so its card never comes back (speakup.js).
async function confirmMail() {
  const x = S.helper; if (!x || x.busy) return;
  x.busy = true; x.failMsg = ''; paintFoot();
  x.before = earned();
  try {
    if (x.mode === 'intro') { app.onAct?.('intro'); introMark('sent'); }   // counted apart (089, R-087)
    else {
      // A chair email stays 'email'; one to your own legislators is 'legislators' (Nate 9/29: "Count the emails separately").
      await markDone(x.b.id, x.mode === 'email' && x.h ? x.h.id : '', x.mode === 'legislators' ? 'legislators' : 'email', true, { quiet: true });
      if (x.mode === 'email' && !x.h && x.code) S.done.add(askMark(x.b, x.code));
      if (x.mode === 'legislators' && x.moment?.key) S.done.add(askMark(x.b, x.moment.key));
      if (x.remind && x.code) S.done.add(askMark(x.b, 'remind:' + x.code));   // the one reminder for this committee (R-153)
      saveDone();
      // Kept for the bill's next step, here and with the account (R-153); never the reminder itself.
      if (!x.remind) { try { keepLetter(mailRecOf(x)); } catch { /* the email counts either way */ } }
      app.onAct?.(x.remind ? 'mail_reminder_sent' : x.again ? 'mail_again_sent' : '');
    }
  } catch (e) { x.busy = false; x.failMsg = friendly(e); paint(); return; }
  if (x.b) {
    const iss = issuesOf(x.b)[0];
    try {
      if (iss && !issueFollowed(iss)) { if (await setFollows({ issuesOn: [iss.id] }) !== false) x.followedIssue = iss; }
      else if (!iss && !S.watch.has(x.b.id)) { await toggleWatch(x.b.id); x.followedNow = S.watch.has(x.b.id); }
    } catch { /* following is a bonus */ }
  }
  if (S.helper !== x) return;
  afterSend(x);
  x.busy = false; x.screen = 'done'; saveDraft();
  paint({ focus: 'hp-done-t', top: true });
  x.askShown = !!S.nudge;
}
// One tap on a send button: copy the message again (the tap allows it, and it carries any edits), let the link open the
// mail app or the new tab, then ask. The dialog is re-drawn a moment later, never inside the tap, so the link still opens.
function sentVia(via) {
  const x = S.helper; if (!x) return;
  copyText(x.letter).then(ok => { if (ok) x.autoCopied = true; });
  x.opened = via; x.welcomed = false; saveDraft();
  setTimeout(() => { if (S.helper === x && x.screen === 'mail' && !x.asked) { x.asked = true; paint({ focus: 'hp-sh' }); announce('Did you send it?'); } }, 800);
}
async function copyPart(part) {
  const x = S.helper; if (!x) return;
  const text = part === 'to' ? x.to.map(t => t.email).filter(Boolean).join(', ') : part === 'subject' ? x.subject : x.letter;
  const ok = await copyText(text);
  if (S.helper !== x) return;
  x.partChip = ok ? { to: 'Address copied', subject: 'Subject copied', body: 'Message copied' }[part] : 'We couldn’t copy it. Go back to select it.';
  paint(); announce(x.partChip);
  setTimeout(() => { if (S.helper === x && x.partChip) { x.partChip = ''; paint(); } }, 2500);
}

function onClick(e) {
  if (e.target.closest('[data-godir]')) app.onAct?.('directions');   // the map's directions opened from the last page (R-142)
  const t = e.target.closest('[data-hp]'); if (!t || !S.helper) return;
  const a = t.dataset.hp;
  if (a === 'done') { const b = S.helper.b; afterClose = () => { app.newcomerNext?.(b); }; requestClose(); }
  else if (a === 'close') requestClose();
  else if (a === 'going') { const x = S.helper; noteGoing(x.h, true); markDone(x.b.id, x.h.id, 'attend', true, { quiet: true }).then(() => { if (S.helper === x) paint({ focus: 'gdt-' + x.h.id }); }); }
  else if (a === 'goics') { const x = S.helper; downloadIcs(x.b, x.h); paint(); }
  else if (a === 'copy') copyLetter();
  else if (a === 'addtitle') { S.helper.tp.adding = true; paintTitles({ step: true }); dlg.querySelector('#hp-tp .tp-chips [data-tp], #hp-tq')?.focus({ preventScroll: true }); }
  else if (a === 'says') {
    // A part of the letter left out, or put back (R-156 B2). An edited letter keeps its words and offers the new details.
    const x = S.helper, v = t.dataset.v, was = t.getAttribute('aria-pressed') === 'true';
    if (v === 'titles') x.use = was ? [] : null;
    else if (v === 'live') x.noLive = was;
    else if (v === 'why') x.noWhy = was;
    const basis = basisOf(x);
    if (!x.edited) { x.letter = letterOf(x); x.basis = basis; x.stale = false; } else x.stale = basis !== x.basis;
    x.copied = x.saved = false; saveDraft(); paint({ focus: 'hp-says-' + v });
    announce(was ? 'Left out.' : 'Put back in.');
  }
  else if (a === 'usestory') {
    const x = S.helper; if (!x.offer) return;
    x.why = x.offer.text; x.whyStory = false; x.offer = null; saveDraft(); paint({ focus: 'hp-why' }); announce('Your story is in. Change it to fit this bill.');
  }
  else if (a === 'storysave') {
    const x = S.helper, box = dlg.querySelector('#hp-sa'), v = (box?.value || '').trim(); x.storyDraft = box?.value || '';
    if (!v) { dlg.querySelector('#hp-sa-msg').innerHTML = `<p class="inlinemsg" role="alert">${icon('circle-alert')}<span>Write a sentence, or choose No thanks.</span></p>`; box?.focus(); return; }
    const tp = topicOf(x);
    saveProfile(tp ? { stories: { ...myStories(), [tp]: v } } : { story: v }).then(() => {
      if (S.helper !== x) return; x.askStory = 'saved'; paint({ focus: 'hp-done-t' }); announce('Saved in your profile.');
    }, e => { const m = dlg?.querySelector('#hp-sa-msg'); if (m) m.innerHTML = `<p class="inlinemsg" role="alert">${icon('circle-alert')}<span>${esc(friendly(e))}</span></p>`; });
  }
  else if (a === 'storyno') {
    const x = S.helper, k = topicOf(x) || 'any'; saveMe({ storyNo: [...new Set([...(loadMe().storyNo || []), k])] });
    x.askStory = null; paint({ focus: 'hp-done-t' });
  }
  else if (a === 'toprofile') { afterClose = () => app.go('#/profile'); requestClose(); }
  else if (a === 'use') {
    // This letter's titles (R-165): a tap adds or takes one off, as many as they like; untapping all writes the letter
    // without titles. A tap never changes the profile.
    const x = S.helper, v = t.dataset.v, two = twoFor(x);
    x.use = two.includes(v) ? two.filter(k => k !== v) : [...two, v];
    saveDraft(); paintTitles({ step: true });
  }
  else if (a === 'next') goNext();
  else if (a === 'back') goBack();
  else if (a === 'stance') { S.helper.stance = t.dataset.v; if (['support', 'oppose'].includes(t.dataset.v) && S.helper.b && myStance(S.helper.b.id) !== t.dataset.v) setStance(S.helper.b.id, t.dataset.v).catch(() => {}); saveDraft(); goNext(); }   // saved on the bill too (R-120, Bug 5)
  else if (a === 'point') {
    // Add or take out one talking point. While the box is as the taps made it, it keeps the order the bill lists them,
    // so the letter reads the same way; once the person has written in it, a tap adds at the end or cuts just that point.
    const x = S.helper, all = pointsOf(x), s = all[+t.dataset.i]; if (!s) return;
    const on = !x.points.includes(s);
    if (!on && x.pointsText.trim() !== pointsLine(x.points) && !x.pointsText.includes(sentence(s))) {
      // They rewrote this point: never cut their writing. Select it in the box, so one press of Delete takes it out.
      const box = dlg?.querySelector('#hp-pts'), span = box && pointSpan(x, box.value, s); if (!span) return;
      box.focus(); box.setSelectionRange(span[0], span[1]);
      announce('Selected in the box. Press Delete to take it out.');
      return;
    }
    if (x.pointsText.trim() === pointsLine(x.points)) { const set = new Set(on ? [...x.points, s] : x.points.filter(p => p !== s)); x.pointsText = pointsLine(all.filter(p => set.has(p))); }
    else x.pointsText = on ? `${x.pointsText.trimEnd()} ${sentence(s)}`.trim() : cutPoint(x.pointsText, sentence(s));
    x.points = pickedIn(x, x.pointsText); saveDraft();
    paint({ focus: undefined }); dlg?.querySelector(`[data-hp="point"][data-i="${t.dataset.i}"]`)?.focus({ preventScroll: true });
    if (on) showBox();
    announce(on ? `Added to your ${isMail(x) ? 'email' : 'letter'}` : `Taken out of your ${isMail(x) ? 'email' : 'letter'}`);
  }
  else if (a === 'closing') {
    const x = S.helper, el = dlg?.querySelector('#hp-closing'); x.closing = t.dataset.v; saveMe({ closing: x.closing });
    if (el) { el.value = x.closing; el.focus({ preventScroll: true }); }
    dlg.querySelectorAll('.hp-sug').forEach(s => s.setAttribute('aria-pressed', String(s.dataset.v === x.closing)));
  }
  else if (a === 'acct-yes' || a === 'acct-done') { saveMe({ capitolAcct: true }); goNext(); }
  else if (a === 'acct-no') { S.helper.acctNew = true; saveDraft(); paint({ focus: 'hp-sh' }); }
  else if (a === 'acct-help') { S.helper.acctHelp = true; paint(); }
  else if (a === 'copyopen') copyAndOpen();
  else if (a === 'trouble') { S.helper.trouble = !S.helper.trouble; paint(); }
  else if (a === 'unfollow') { const x = S.helper, i = x.followedIssue; if (i) setFollows({ issuesOff: [i.id] }).then(() => { x.followedIssue = null; paint(); announce(`You no longer follow ${i.name}.`); }); }
  else if (a === 'download') download();
  // "I already sent it" counts exactly like the green-box button: same honest question, asked without the round trip.
  else if (a === 'confirm' || a === 'sent') confirmSent();
  else if (a === 'relink') { sendLink(S.helper, { again: true }); paint({ focus: 'hp-inbox' }); }
  else if (a === 'later') finishLater();
  else if (a === 'share') tellFriend();
  else if (a === 'email') emailInstead();
  else if (a === 'send') sentVia(t.dataset.via);
  else if (a === 'mailsent') confirmMail();
  else if (a === 'copypart') copyPart(t.dataset.part);
  else if (a === 'again-use') { if (S.helper.check?.level === 'big') app.onAct?.('again_fixed'); goTo(2); }
  else if (a === 'again-update') {
    // Walk the bill step and About you again with their words in place; a hand-written letter stays theirs (the letter
    // screen offers "Use my new details" if they change an answer).
    const x = S.helper; x.update = true;
    if (!x.letterReady) { x.letter = againLetter(x); x.basis = basisOf(x); x.letterReady = true; }
    if (x.check?.level !== 'big') app.onAct?.('again_fixed'); goTo('know');
  }
  else if (a === 'again-new' || a === 'again-forget') {
    const x = S.helper;
    // Deleted with an Undo for the rest of this walkthrough (B-5): the letter is kept in hand until then.
    if (a === 'again-forget' && x.again) { x.forgotten = x.again; forgetLetter(x.again.rec.bill, x.again.rec.kind === 'email' ? 'email' : 'testimony'); }
    else app.onAct?.('again_new');
    // Where they stand stays as the letter had it (their stance on the bill page wins); it is asked only if neither says.
    const mine = myStance(x.b.id);
    Object.assign(x, { again: null, update: false, check: null, letterReady: false, keepPts: false, mentions: [], points: [], pointsText: '', letter: '', edited: false, basis: '', stale: false });
    x.stance = mine === 'support' || mine === 'oppose' ? mine : x.stance || null; x.askStance = !x.stance;
    goTo(x.askStance ? 'stand' : 'know');
    if (a === 'again-forget') announce('Your saved letter is deleted.');
  }
  else if (a === 'again-undo') {
    // Undo the delete: the letter is kept again, here and on the account, and offered as before.
    const x = S.helper, r = x.forgotten; if (!r) return;
    x.forgotten = null; keepLetter(r.rec); againFrom(x, r, loadMe()); x.screen = 'again'; paint({ focus: 'hp-sh', top: true }); announce('Your letter is back.');
  }
  else if (a === 'rewrite') { const x = S.helper; x.letter = letterOf(x); x.basis = basisOf(x); x.edited = false; x.stale = false; x.copied = x.saved = false; paint({ focus: 'hp-letter' }); }
  // 'capitol' is a plain link to the Capitol site in a new tab.
}
function onInput(e) {
  const x = S.helper, t = e.target; if (!x) return;
  if (t.id === 'hp-name' || t.id === 'hp-why' || t.id === 'hp-closing') {
    const f = t.id.slice(3); x[f] = t.value;
    saveMe(f === 'why' ? (x.b ? { why: t.value, whyBill: x.b.id } : { introWhy: t.value }) : { [f]: t.value.trim() });
    if (f === 'closing') dlg.querySelectorAll('.hp-sug').forEach(s => s.setAttribute('aria-pressed', String(s.dataset.v === t.value.trim())));
    if (x.errs[f] && t.value.trim()) setErr(f, false);
    if (f === 'why') { const n = dlg.querySelector('#hp-savelen'); if (n) n.textContent = t.value.trim().length > 600 ? 'Your profile keeps the first 600 characters.' : ''; }
  } else if (t.id === 'hp-sa') {
    x.storyDraft = t.value;
  } else if (t.id === 'hp-savestory') {
    x.saveStory = t.checked;
  } else if (t.id === 'hp-email') {
    // Remembered like the name, so a phone that reloads the tab brings it back. The error (shown only after
    // leaving the field or choosing See my letter) clears as soon as the address looks right, or the box is empty.
    const v = t.value.trim(); x.email = t.value; saveMe({ email: v });
    if (x.errs.email && (!v || validEmail(v))) setErr('email', false);
  } else if (t.id === 'hp-pts') {
    // Their own words for the points (R-141). A point whose words are no longer all there shows Add again.
    x.pointsText = t.value; x.points = pickedIn(x, t.value); grow(t); saveDraft();
    const all = pointsOf(x);
    dlg.querySelectorAll('[data-hp="point"]').forEach(b => {
      const on = x.points.includes(all[+b.dataset.i]); if (b.getAttribute('aria-pressed') === String(on)) return;
      b.setAttribute('aria-pressed', String(on)); b.querySelector('.hp-pti').innerHTML = icon(on ? 'check' : 'plus'); b.querySelector('.hp-pta').textContent = on ? 'Added' : 'Add';
    });
  } else if (t.id === 'hp-subject') {
    x.subject = t.value; x.subjectEdited = true;
  } else if (t.id === 'hp-letter') {
    x.letter = t.value; x.edited = true; grow(t);
    const sm = dlg.querySelector('[data-hp="selfmail"]'); if (sm) sm.href = selfMail(x);   // the copy to themselves carries their edits
    if (x.copied || x.saved || x.copyFail) { x.copied = x.saved = x.copyFail = false; paintFoot(); dlg.querySelector('.hp-under .okmsg')?.remove(); }
  }
}
function onBlur(e) {
  const x = S.helper, id = e.target.id;
  // Not when the whole page loses focus (switching apps), only when the person moves on from the field.
  if (!x || !['hp-name', 'hp-email'].includes(id) || !document.hasFocus() || !dlg?.contains(e.relatedTarget || dlg)) return;
  const v = e.target.value.trim();
  if (id === 'hp-email') { if (v && !validEmail(v)) setErr('email', true); }   // optional: empty is never an error
  else if (!v) setErr(id.slice(3), true);
}
function onKey(e) {
  if (e.key !== 'Enter' || e.isComposing) return;
  // Enter moves on to the next field instead of skipping "why".
  if (e.target.id === 'hp-name') { e.preventDefault(); dlg.querySelector('#hp-email, #hp-why')?.focus(); }
  else if (e.target.id === 'hp-email') { e.preventDefault(); dlg.querySelector('#hp-why')?.focus(); }
}
function listen(d) {
  d.addEventListener('cancel', e => { e.preventDefault(); requestClose(); });   // Esc, and Android's Back on a modal
  d.addEventListener('close', () => { if (S.helper && d === dlg && d.isConnected && !d.open) requestClose(); });
  d.addEventListener('click', onClick);
  d.addEventListener('input', onInput);
  d.addEventListener('focusout', onBlur);
  d.addEventListener('keydown', onKey);
  d.addEventListener('submit', e => { if (e.target.id === 'hp-form') { e.preventDefault(); toLetter(); } });
  d.addEventListener('focusin', e => { if (S.helper && e.target.id) S.helper.focusId = e.target.id; });
  d.addEventListener('scroll', e => { if (S.helper && e.target.classList?.contains('hp-body')) S.helper.scrollTop = e.target.scrollTop; }, true);
}
// After a reload with the helper open, open it again once its hearing is known (the bill page may still be loading).
function tryReopen() {
  if (reopen === null) { const o = openMark.get(); reopen = o ? { ...o, until: Date.now() + 10000 } : false; }
  if (!reopen) return;
  if (Date.now() > reopen.until) { reopen = false; openMark.set(null); return; }
  const mail = reopen.mode && reopen.mode !== 'testimony';
  if (reopen.h ? !anyHearing(reopen.h) : mail && reopen.b && !anyBill(reopen.b)) return;
  if (mail && !(S.legislators || []).length) return;
  const o = reopen; reopen = false;
  setTimeout(() => { if (!S.helper) { if (mail) openMail(o.o || {}); else open(o.b, o.h); } }, 0);
}

export default {
  render() {
    const x = S.helper; if (!x) return '';
    return `<dialog class="sheet hp-dlg${isMail(x) ? ' hp-mail' : ''}" id="hp-dlg" data-key="${esc([x.mode, x.b?.id || '', x.h?.id || '', x.code || ''].join('|'))}" aria-labelledby="${x.screen === 'done' ? 'hp-done-t' : 'hp-title'}">${inner()}</dialog>`;
  },
  wire() {
    const x = S.helper;
    if (!x) { dlg = null; document.body.classList.remove('hp-lock'); tryReopen(); return; }
    const fresh = document.getElementById('hp-dlg'); if (!fresh) return;
    document.body.classList.add('hp-lock');
    if (dlg && dlg !== fresh && dlg.dataset.key === fresh.dataset.key) {
      // The page behind re-rendered: put the live dialog back so typing, scroll and focus are not lost.
      fresh.replaceWith(dlg); dlg.removeAttribute('open');
      try { dlg.showModal(); } catch { dlg.setAttribute('open', ''); }
      const body = dlg.querySelector('.hp-body'); if (body) body.scrollTop = x.scrollTop || 0;
      ((x.focusId && dlg.querySelector('#' + CSS.escape(x.focusId))) || dlg.querySelector('#hp-title, #hp-done-t'))?.focus({ preventScroll: true });
      if (drawnWith !== outside()) paint();   // e.g. "Not now" on the email ask, or its "Check your inbox"
      return;
    }
    dlg = fresh; listen(dlg); drawnWith = outside();
    try { dlg.showModal(); } catch { dlg.setAttribute('open', ''); }
    afterPaint();
    const first = x.resumed ? dlg.querySelector('#hp-sh') : dlg.querySelector('#hp-title');
    (first || dlg.querySelector('#hp-done-t'))?.focus({ preventScroll: true });
  },
};
