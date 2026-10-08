// What a shared link's preview card says, and where the link opens (R-169, Nate 10/5: "Card wording should lead with
// the action that is being asked of them. The link needs to link them to taking action, not just the bill page.").
//
// A bill has one share page per ask (tools/share_pages.mjs writes them): b/HB1573-testify, b/HB1518-ask, b/HB1-floor,
// b/HB1-conference, b/HB1-governor and b/HB1523-follow, plus b/HB1573, which carries the bill's ask of the moment. Since
// R-205 (10/7) a hearing ahead has two more: b/HB1573-email (a short email to the committee, the 2-minute way) and
// b/HB1573-attend (come to the hearing), so the person sharing picks what their friend is asked to do (pub/askfriend.js). The
// tracker shares the page for the ask the person is looking at (pub/core.js billShareUrl), so the card a friend sees
// names that ask first ("Speak up by Wed, Mar 18: ...") and the link opens it (#/bill/2026/HB1573/testify opens the
// testimony walkthrough, pub/bill.js). Preview robots read only the page's title, words and picture; most never run a
// script, so the words have to be right in the page itself.
//
// Pure: no network, no files. The bill is a public_all_bills row; ctx carries what the page builder read.
import { billStop, isResolution, CHAMBER_NAME } from '../stops.js';

export const ASKS = ['testify', 'email', 'attend', 'ask', 'floor', 'conference', 'governor', 'follow'];
// The asks of a hearing ahead (R-205): what a friend can do before it, one page each.
export const HEARING_ASKS = ['testify', 'email', 'attend'];
// Hawaiʻi time, whatever machine builds the pages (the GitHub runner keeps UTC).
const fmt = (iso, o) => new Intl.DateTimeFormat('en-US', { timeZone: 'Pacific/Honolulu', ...o }).format(new Date(iso));
export const dayWords = iso => fmt(iso, { weekday: 'short', month: 'short', day: 'numeric' });   // "Wed, Mar 18"
export const timeWords = iso => fmt(iso, { hour: 'numeric', minute: '2-digit' });                // "9:30 AM"
const spaced = n => String(n).replace(/^([A-Z]+)\s*(\d)/, '$1 $2');
const cut = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…'; };
const sentence = s => s ? s.replace(/([^.!?…])$/, '$1.') : '';
// "Conference Room 229" as the page says it, "Room 229" (pub/core.js clean and roomLabel); '' when it is not set yet.
const roomWords = r => { const x = String(r || '').replace(/\s*via videoconference/i, '').replace(/^(Conference Room|CR|Rm)\s+/i, 'Room ').trim(); return !x || /TBD/i.test(x) ? '' : x; };
// HIPHI's side in words (pub/kernel.js posInfo says the same on the page).
const POS = { strongly_support: 'HIPHI strongly supports it.', support: 'HIPHI supports it.', support_amend: 'HIPHI supports it with changes.',
  strongly_oppose: 'HIPHI strongly opposes it.', oppose: 'HIPHI opposes it.', neutral: 'HIPHI has comments on it.', monitor: 'HIPHI is watching it.' };
// support | oppose | neutral | '' (monitor): asking a chair needs a side; the floor, the final version and the Governor
// need support or oppose (pub/bill.js situation).
const sideOf = b => /oppose/.test(b.hiphi_position || '') ? 'oppose' : /support/.test(b.hiphi_position || '') ? 'support' : b.hiphi_position === 'neutral' ? 'neutral' : '';
const OVER = ['law', 'vetoed', 'ballot', 'dead'];

// "the House Health committee", "the Senate Judiciary and Ways and Means committees".
export function committeeWords(code, committees = {}) {
  const codes = String(code || '').split('/').map(c => c.trim()).filter(Boolean);
  if (!codes.length) return 'the committee';
  const known = codes.map(c => committees[c]).filter(Boolean);
  if (!known.length) return `the ${codes.join(' and ')} ${codes.length > 1 ? 'committees' : 'committee'}`;
  const ch = CHAMBER_NAME[known[0].chamber] || '';
  return `the ${ch ? `${ch} ` : ''}${known.map(c => c.name).join(' and ')} ${known.length > 1 ? 'committees' : 'committee'}`;
}

// Where the bill stands and its ask of the moment, the same reading the bill page makes (pub/bill.js situation): a
// hearing ahead is testimony, for everyone; a bill waiting for its hearing is the chair's email; then the floor vote,
// the final version and the Governor; anything else, and every bill that is over, is following its issue.
// ctx: { hearings (this bill's, from public_all_hearings), outcomes ({ hearing_id: { outcome } }), deadlineFor(key), now }
export function billState(b, ctx = {}) {
  const now = ctx.now ?? Date.now(), hs = (ctx.hearings || []).filter(h => h.status !== 'cancelled');
  const st = billStop(b, { hearings: hs, outcomes: ctx.outcomes || {}, deadlineFor: ctx.deadlineFor || (() => null), now });
  const over = OVER.includes(st.phase);
  const open = over ? null : hs.filter(h => h.status === 'scheduled' && new Date(h.scheduled_at).getTime() > now)
    .sort((x, y) => String(x.testimony_deadline || x.scheduled_at).localeCompare(String(y.testimony_deadline || y.scheduled_at)))[0] || null;
  const side = sideOf(b), firm = side === 'support' || side === 'oppose';
  const ask = over ? 'follow' : open ? 'testify'
    : side && st.phase === 'committee' && st.hearingState === 'none' && st.committee && !st.deadline?.missed ? 'ask'
    : firm && ['floor', 'conference', 'governor'].includes(st.phase) ? st.phase : 'follow';
  return { st, open, ask, over, side, now };
}

// The asks a bill gets its own page for. Following always; testimony while it is alive (a hearing can be set any day,
// and a page that is already there previews even in the hour before the next rebuild); the others while it is at that
// step. An ask with no page yet still works: 404.html sends the link on to the same action. The committee email and the
// hearing itself (R-205) only while a hearing is ahead: their words need its day, room and committee.
export function asksFor(b, state) {
  if (state.over) return ['follow'];
  const out = ['testify', ...(state.open ? ['email', 'attend'] : []), 'follow'], firm = state.side === 'support' || state.side === 'oppose';
  if (state.side && state.st.phase === 'committee') out.push('ask');
  if (firm && ['floor', 'conference', 'governor'].includes(state.st.phase)) out.push(state.st.phase);
  return out;
}

// The card's picture (pub/og/<name>.png, drawn by tools/og_images.py): the ask in large words, since in a text the picture
// is most of the card and the title a small line under it (Nate 10/5: "the share card is not specific about the action").
export function imageFor(ask, state) {
  const no = state.side === 'oppose';
  if (ask === 'testify') return 'testify';
  if (ask === 'email' || ask === 'attend') return ask;
  if (ask === 'ask') return no ? 'hold' : 'ask';
  if (ask === 'floor') return no ? 'floor-no' : 'floor-yes';
  if (ask === 'conference') return no ? 'conference-no' : 'conference-yes';
  if (ask === 'governor') return no ? 'governor-veto' : 'governor-sign';
  return state.st.phase === 'law' ? 'law' : 'follow';
}

// The card for one ask: { title, desc, hash, image }. Every title starts with the ask and ends with the bill's name and
// number (DESIGN.md C-10: the nickname, and always the number); the words under it say why now and how long it takes.
// ctx: { committees ({ code: { name, chamber } }), issue ({ slug, name } | null) }
export function cardFor(b, ask, state, ctx = {}) {
  const n = String(b.bill_number).replace(/\s/g, ''), y = +b.session_year || 0, ref = `${y ? `${y}/` : ''}${n}`;
  const named = b.hiphi_nickname ? `${b.hiphi_nickname} (${spaced(n)})` : spaced(n);
  // A bill without an everyday name (most bills HIPHI only watches) says what it does first.
  const about = b.hiphi_nickname ? '' : `${sentence(cut(b.hiphi_summary || b.description || '', 120))} `;
  const pos = POS[b.hiphi_position] || '', st = state.st, side = state.side, now = state.now ?? Date.now();
  const by = st.deadline && !st.deadline.missed && st.deadline.date ? ` by ${dayWords(st.deadline.date)}` : '';
  const done = (title, desc, open) => ({ title, desc: `${desc} ${pos}`.replace(/\s+/g, ' ').trim(), hash: `#/bill/${ref}${open ? `/${open}` : ''}`, image: imageFor(ask, state) });
  if (ask === 'testify') {
    const h = state.open, due = h && h.testimony_deadline && new Date(h.testimony_deadline).getTime() > now ? h.testimony_deadline : null;
    return done(h ? `Speak up by ${dayWords(due || h.scheduled_at)}: ${named}` : `Speak up: ${named}`,
      `${about}Tell ${h ? committeeWords(h.committee, ctx.committees) : 'the committee'} what you think before ${h ? `its hearing on ${dayWords(h.scheduled_at)}` : 'its hearing'}.${due ? ` Testimony is due ${dayWords(due)} at ${timeWords(due)}.` : ''} It takes a few minutes; we help you write it.`, 'testify');
  }
  // The two other ways to help before a hearing (R-205): the committee email (2 minutes) and going in person.
  if (ask === 'email') {
    const h = state.open;
    return done(h ? `Email the committee before ${dayWords(h.scheduled_at)}: ${named}` : `Email the committee: ${named}`,
      `${about}A short email to ${h ? committeeWords(h.committee, ctx.committees) : 'the committee'} before ${h ? `its hearing on ${dayWords(h.scheduled_at)}` : 'its hearing'} takes about 2 minutes; we write it with you.`, 'email');
  }
  if (ask === 'attend') {
    const h = state.open, r = h ? roomWords(h.room) : '', room = r ? `, ${r}` : '';
    return done(h ? `Come to the hearing on ${dayWords(h.scheduled_at)}: ${named}` : `Come to the hearing: ${named}`,
      `${about}${h ? `${committeeWords(h.committee, ctx.committees).replace(/^the /, 'The ')} hears it ${dayWords(h.scheduled_at)} at ${timeWords(h.scheduled_at)}${room}, at the State Capitol.` : 'The committee hears it at the State Capitol.'} Anyone can attend, and we tell you where to go.`, 'attend');
  }
  if (ask === 'ask') {
    const where = st.phase === 'committee' && st.committee ? ` in ${committeeWords(st.committee, ctx.committees)}` : '';
    return side === 'oppose'
      ? done(`Ask the chair to hold: ${named}`, `${about}It is waiting for a hearing${where}. A short email asking the chair not to hear it takes about 2 minutes; we write it with you.`, 'ask')
      : done(`Ask for a hearing: ${named}`, `${about}It needs a hearing${where}${st.phase === 'committee' ? by : ''} or it can’t pass this year. A short email to the chair takes about 2 minutes; we write it with you.`, 'ask');
  }
  if (ask === 'floor') {
    const ch = st.phase === 'floor' ? st.chamber : null, who = ch === 'S' ? 'senator' : ch === 'H' ? 'representative' : 'legislators';
    return done(`Ask your ${who} to vote ${side === 'oppose' ? 'no' : 'yes'}: ${named}`,
      `${about}It goes to a vote of the full ${ch ? CHAMBER_NAME[ch] : 'House or Senate'}${st.phase === 'floor' ? by : ''}. A short email to your own ${who} takes about 2 minutes.`, 'floor');
  }
  if (ask === 'conference') return done(side === 'oppose' ? `Ask lawmakers not to pass it: ${named}` : `Ask lawmakers to pass it: ${named}`,
    `${about}The House and Senate are working out one final version${st.phase === 'conference' ? by : ''}. A short email takes about 2 minutes.`, 'conference');
  if (ask === 'governor') return done(side === 'oppose' ? `Ask the Governor to veto: ${named}` : `Ask the Governor to sign: ${named}`,
    `${about}It passed the Legislature and is on the Governor’s desk. A short message takes about 2 minutes.`, 'governor');
  // Following: a bill that is over (or has no ask right now) shares its issue, where Follow is the main button.
  const i = ctx.issue || null, yr = y ? ` in ${y}` : '';
  const news = st.phase === 'law' ? `${named} ${isResolution(b) ? 'was adopted' : 'became law'}${yr}.`
    : st.phase === 'vetoed' ? `${named} was vetoed${yr}.`
    : st.phase === 'ballot' ? `${named} passed the Legislature; the voters decide in November.`
    : st.phase === 'dead' ? `${named} did not advance${yr}. Ideas like this often come back.`
    : `${named}: ${sentence(cut(b.hiphi_summary || b.description || '', 140))}`;
  return { title: i ? `Follow the issue: ${i.name}` : `Follow ${named}`,
    desc: `${news} ${i ? 'Follow the issue' : 'Follow it'} and we’ll tell you when your voice can count.`.replace(/\s+/g, ' ').trim(),
    hash: i ? `#/issue/${i.slug}` : `#/bill/${ref}`, image: imageFor('follow', state) };
}
