// The words of the plans' alerts sign-up (R-164; Nate 10/5: "needs to be more friendly and warm and positive. It doesn't
// have to just be about tuesday ... Research best practices for this part. We don't need to reinvent the wheel about
// getting people to sign-up"). The research (10/5, kept with R-164) found: ask right after the person has done something
// (permission asks there reach far more yeses than up-front ones); give a concrete reason; show exactly what will arrive;
// promise a limit people can picture (sending too often is the top reason people leave a text list); make "Not now" an
// equal button; never say "spam", "don't miss out" or "most people don't" (saying few people act backfires).
// Two versions, tested against each other on the plans (variant.js 'join', backend 138):
//   shown  "Want a heads-up for the next one?" with an example text, drawn as a message and labelled as an example
//   watch  "We'll watch it. You speak up when it counts." with three steps: a hearing is set, we text you, you send a note
// Only the heading, the lines under it and the example live here; the box, its consent line and its small print are
// pub/alerts.js's, unchanged, so what a person agrees to is always the versioned wording (text_consent_words, C-4).
import { shortDay } from './start.js';

// How often, said honestly: in the 2026 session someone following three typical issues had hearings in 7 of 16 weeks,
// on at most 2 days in any week (measured 10/5 from hearings and bill_issues). HIPHI's own asks come on top, and the
// daily cap holds for both.
// The cap itself ("at most one a day") is in the consent words under the box, so it is not said twice (the review, A-14).
export const OFTEN = 'Usually once or twice a week, January to May';

// An issue's name is often a policy ("Lower the DUI limit to .05"), so inside a sentence it goes in quotes.
const whatOf = follows => follows.length === 1 ? `“${follows[0].name}”` : follows.length ? 'your issues' : '';
// "Rep. David A. Tarnas" -> kept whole; two -> "Sen. Kim and Rep. Lee"
const names = xs => xs.length <= 1 ? (xs[0] || '') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;

// { arm, acted, follows, off, open, remind } -> { receipt, h, lede, steps? }
// remind: Plan 1's "Remind me before ..." ({ name, due }), which this ask then keeps (the same words in both versions).
export function joinWords({ arm = 'shown', acted = null, follows = [], off = false, open = '', remind = null }) {
  if (remind) return { receipt: '', h: `We’ll remind you before ${remind.day}`,
    lede: `Where should the reminder go? It comes the day before notes on ${remind.name} are due, with a link straight to your email.` };
  const what = whatOf(follows);
  const receipt = acted?.kind === 'email' ? `Your note${acted.to?.length ? ` to ${names(acted.to)}` : ''} is on its way.`
    : acted?.kind === 'intro' ? `Your hello${acted.to?.length ? ` to ${names(acted.to)}` : ''} is on its way.` : '';
  const when = off && open ? ` The session opens ${shortDay(open)}.` : '';
  if (arm === 'watch') return {
    receipt,
    // A question, not a statement, so it never reads as if alerts were already on (the review, 10/5).
    h: what && what !== 'your issues' && what.length <= 42 ? `Want us to watch ${what} for you?` : 'Want us to keep watch for you?',
    lede: `When a bill on ${what || 'your issues'} gets a hearing, we tell you the time and a two-minute way to weigh in.${when}`,
    steps: [['calendar', 'A hearing is set'], ['message-square', 'We tell you'], ['send', acted ? 'You send a note, like today' : 'You send a note in 2 minutes']],
  };
  return {
    receipt,
    h: acted ? 'Want a heads-up for the next one?' : 'Want a heads-up when it counts?',
    // One sentence (the review: the box arrived too low on a phone). Someone who has not met a hearing yet is told what
    // one is in the same breath.
    lede: acted ? `Hearings are set only about two days ahead, so we’ll tell you in time to do this again.${when}`
      : `Lawmakers give only about two days’ notice before they hear the public on a bill, so we’ll tell you in time.${when}`,
  };
}

// An example of an alert, made from what this person follows, so the promise is concrete. Never a real bill number or a
// real day, so it cannot pass for a real alert; the screen labels it "Example" too.
export function sampleText({ follows = [], email = false, topic = '', remind = null }) {
  if (remind) return email ? { subject: `Notes on ${remind.name} are due ${remind.day}`, body: 'Yours takes about 2 minutes, and we walk you through it.' }
    : { body: `HIPHI: Notes on ${remind.name} are due ${remind.day}. Yours takes about 2 minutes (a link to it). Reply STOP to end.` };
  const what = follows[0]?.name ? `“${follows[0].name}”` : topic || 'a bill you follow';
  return email
    ? { subject: `A hearing on ${what} is set`, body: `It’s on Thursday at 2 pm. A short note from you helps, and it takes about 2 minutes. We’ll walk you through it.` }
    : { body: `HIPHI: A hearing on ${what} is set for Thu at 2 pm. Send a note in 2 minutes (a link to the bill). Reply STOP to end.` };
}

// After a yes: what happens now, warmly, and the one thing that helps (know the number when it texts).
export function joinDone(r, follows = []) {
  const what = whatOf(follows) || 'your issues';
  if (r?.kind === 'phone') return {
    h: 'You’re set',
    lede: r.confirmed ? `We’ll text you when a bill on ${what} gets a hearing.` : `We’ll text you when a bill on ${what} gets a hearing. Our first text says who we are and asks you to reply YES.`,
    tip: 'Save our number as HIPHI, so you know it’s us.',
  };
  if (r?.kind === 'email') return { h: 'One tap to go', lede: `We sent a link to ${r.email}. Tap it to turn on alerts about ${what}.`, tip: 'Can’t find it in a minute? Check your spam or promotions folder.' };
  return { h: 'You’re set', lede: `Alerts about ${what} go to your account’s email.`, tip: '' };
}
