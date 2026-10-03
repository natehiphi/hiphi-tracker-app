// The versions of the first visit, and how a browser gets one (R-098 the two endings; R-121 the A/B testing process).
//
// The test now running: the first visit's ending. 'today' ends on "You're all set"; 'home' ends ON Home: the
// celebration plays on the real page ("Mahalo! This is your home page"), "What you can do right now" is open, and
// three tips show the page; the words say the home page shows your moment and email is a backup.
//
// How a browser gets a version (R-121):
//   the coin toss   a browser that has never been given one gets one at random, half and half, the first time the
//                   page loads, and keeps it (hiphi_wiz.end, with arm and forced). Every private count carries it
//                   (visitlog.js: variant, forced), so the two can be compared on the same days.
//   the link        ?end=home or ?end=today sets it and marks it forced: the testers' links and a staff check. A forced
//                   browser is counted apart and never in the comparison (a tester is not the public).
// The comparison is on Staff v2 > Outreach > Issues > First visit > Versions (first_visit_variants, migration 113). The
// process, the measure and the rule for ending a test: ../backend/docs/AB-TESTING.md. Today's version is the
// default for anything that does not toss (the sandbox never tosses: the testers pick by link).
import { DEMO, wiz, wizSet } from './kernel.js';

export const EXPERIMENT = { key: 'end', arms: ['today', 'home'], since: '2026-10-01' };

try {
  const e = new URLSearchParams(location.search).get('end');
  if (e === 'home' && (wiz().end !== 'home' || !wiz().forced)) wizSet({ end: 'home', arm: 'home', forced: true });
  else if (e === 'today' && (wiz().end || !wiz().forced)) wizSet({ end: null, arm: 'today', forced: true });
  // An automated browser (the test suites) never tosses: it gets today's version unless its link says otherwise, so a
  // suite that asserts the ending it asked for never meets the other by chance.
  else if (!DEMO && navigator.webdriver !== true && !wiz().arm && !wiz().done && !wiz().skipped) {
    // The coin toss, once, for a browser on its first visit that no link has decided for.
    const arm = EXPERIMENT.arms[Math.random() < 0.5 ? 0 : 1];
    wizSet({ arm, end: arm === 'home' ? 'home' : null, forced: false });
  }
} catch { /* storage blocked: today's version */ }

export const endHome = () => wiz().end === 'home';
// The version this browser has and whether a link forced it, for every count. A browser from before the toss (no arm
// recorded) reports today's version as its own, unforced, so its counts still join the comparison.
export const variantInfo = () => { try { const w = wiz(); return { variant: w.arm || (w.end === 'home' ? 'home' : 'today'), forced: !!w.forced }; } catch { return { variant: 'today', forced: false }; } };
