// A second version of the first visit's ending, to test beside today's before choosing (R-098, Nate 9/29: testers felt
// the first visit was over once they gave their email, and that Home did nothing; "Provide a separate example that I can
// test before committing to it", "Two links"). In this version the first visit ends ON Home: the celebration plays on
// the real page ("Mahalo! This is your home page"), "What you can do right now" is open, and three tips show the page.
// The words say the home page shows your moment and email is a backup ("we'll show you", "Want an email too?").
//   ?end=home   turns it on, and the first visit remembers it (hiphi_wiz), like ?fv=short
//   ?end=today  turns it off again
// Today's version stays the default until Nate picks. The track.html restart line (?demo=1&restart) clears the sandbox's
// own storage first, so either link can start a practice first visit from the beginning.
import { wiz, wizSet } from './core.js';

try {
  const e = new URLSearchParams(location.search).get('end');
  if (e === 'home' && wiz().end !== 'home') wizSet({ end: 'home' });
  else if (e === 'today' && wiz().end) wizSet({ end: null });
} catch { /* storage blocked: today's version */ }

export const endHome = () => wiz().end === 'home';
