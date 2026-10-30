// The words of Home's slide, for the pages that say the same thing (R-357, Nate 30 Oct 2026: the bill page opens like Home's slide).
// pub/calm/home.js (dueParts, askParts, goalOf) keeps its own copy of these lines for now, because that file is another build's:
// when version 2's Home lands (Part 3) it imports them from here, so a sentence is written once. Nothing here draws markup; the
// strings are plain text and the caller escapes them. Self-contained on purpose (core.js and the goals list only), so Home can
// use it without pulling the bill page in.
import { S, HST, agrees, codesOf, dayWord, timeWord, followedIssues, issueBills, issuesOf, hiT, dateLong, chairContacts, myActions } from '../core.js';
import { GOAL } from '../calm/goals.js';

const time = iso => timeWord(iso);   // as the card writes it ("1:00 PM")
// "today", "tomorrow", "Wed" within the week; "Mar 30" further out, where a weekday alone would be ambiguous.
export function dayShort(iso) {
  const d = dayWord(iso);
  if (/^today/.test(d)) return 'today';
  if (/^tomorrow/.test(d)) return 'tomorrow';
  return Date.parse(iso) - Date.now() < 6 * 864e5 ? new Date(iso).toLocaleDateString('en-US', { timeZone: HST, weekday: 'short' })
    : new Date(iso).toLocaleDateString('en-US', { timeZone: HST, month: 'short', day: 'numeric' });
}
// "today", "tomorrow", "Friday" within the week, "on Mar 30" further out.
export function dayLong(iso) {
  const d = dayShort(iso);
  if (d === 'today' || d === 'tomorrow') return d;
  return Date.parse(iso) - Date.now() < 6 * 864e5 ? new Date(iso).toLocaleDateString('en-US', { timeZone: HST, weekday: 'long' }) : 'on ' + d;
}
// "tomorrow 1:00 PM", "Wed 9:30 AM", "1:00 PM today" (the words table, section 6).
export const byWhen = iso => { const d = dayShort(iso); return d === 'today' ? `${time(iso)} today` : `${d} ${time(iso)}`; };
// Inside 24 hours the time is amber (A-5), on the time alone.
export const soon = iso => Date.parse(iso) - Date.now() < 864e5;

const NUM = ['', 'One', 'Two', 'Three', 'Four', 'Five'], CH = { S: 'Senate', H: 'House' };
export function whoHears(code) {
  const cs = codesOf(code), ch = CH[S.committees?.[cs[0]]?.chamber] || '';
  return cs.length > 1 ? `${NUM[cs.length] || cs.length} ${ch ? ch + ' ' : ''}committees` : `The ${ch ? ch + ' ' : ''}committee`;
}

// The issue a bill is followed through, else its first issue (the slide's issueFor).
export const issueFor = b => followedIssues().find(i => issueBills(i).includes(b.id)) || issuesOf(b)[0] || null;
// The heading that says the goal ("Help put more local food in school meals", goals.js). '' when there is none: an issue with no line
// yet, a bill on no issue, and someone who sees the bill differently from HIPHI, so a heading never puts words in their mouth.
export const goalFor = b => { const i = issueFor(b); return (agrees(b) !== false && i && GOAL[i.slug]) || ''; };

// What happens next and why a note helps, for a hearing ahead: "The Senate committee hears it Wednesday. A short note from you
// can help it pass." late: written testimony closed, the hearing still ahead.
export function hearingSay(b, h, late = false) {
  const differs = agrees(b) === false, opp = /oppose/.test(b.hiphi_position || '');
  const hears = `${whoHears(h.committee)} ${codesOf(h.committee).length > 1 ? 'hear' : 'hears'} it ${dayLong(h.scheduled_at)}${late ? ` at ${time(h.scheduled_at)}` : ''}.`;
  const ask = late ? 'Late testimony is still taken, marked late.'
    : differs ? 'You see this one differently from HIPHI, and you can still tell them what you think.'
    : b.hiphi_action ? b.hiphi_action : `A short note from you can help ${opp ? 'stop it' : 'it pass'}.`;
  return `${hears} ${ask}`;
}
// A bill waiting for a hearing before its committee's cut-off: what the chair can do. hold: HIPHI opposes it, so the note asks
// the chair not to hear it (bill.js doWords says the same).
export function askSay(st, hold = false) {
  const n = codesOf(st.committee).length, chairs = chairContacts(st.committee).length > 1 ? 'chairs' : 'chair';
  const cs = whoHears(st.committee).replace(/^The /, n > 1 ? '' : 'A ');
  return `${cs} ${n > 1 ? 'haven’t' : 'hasn’t'} heard it yet. ${hold ? `A short, polite note asking the ${chairs} not to hear it can help.` : `When people ask, the ${chairs} can give it one.`}`;
}
// The hearing ask's cut-off, as a time (Home's: the start of its last afternoon), for the amber inside 24 hours.
export const cutoffAt = st => hiT(st.deadline.date) + 12 * 36e5;
export const cutoffDay = st => dateLong(st.deadline.date + 'T12:00:00-10:00');
// "about 10 min the first time": the Capitol asks for a free account once, so the first testimony takes longer (the walkthrough's
// own promise, "About 15 minutes the first time", measured in the walk of 28 Oct at about 10); after one has gone it is about 3.
// The kept "done" marks say whether this person has sent testimony before.
export const sentBefore = () => myActions().some(a => a.kind === 'testimony');
export const testimonyTime = () => sentBefore() ? 'about 3 min' : 'about 10 min the first time';
