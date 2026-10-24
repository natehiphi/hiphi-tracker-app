// Where a bill stands, in six words (R-212 #44, DESIGN C-15). WORDS ONLY, like talk-data.js: the one list every public
// screen uses to group, filter and count bills (All bills' groups and "Where it stands" filter, Find's and My issues'
// "moving / became law / did not advance"), and the one place each word is explained: Help's "What do labels like
// 'Waiting for a hearing' mean?" (pub/talk-data.js) is drawn from `means` below. Change a word here and every screen
// follows. Which one a bill is in is decided once too, by core.js standOf(b). A bill's own row may say more than its
// group ("Waiting for a hearing · 5 days left", core.js plainStatus) but never something else.
// Before this, All bills and Find each had their own rule: a change to the state constitution that both chambers passed
// was "Passed the Legislature" on All bills and "Did not advance" on Find and My issues.
// Hawaiʻi: such an amendment goes to the voters in November, not to the Governor (R-072), so "Passed the Legislature"
// covers both; a veto that is not overridden ends the bill, so a vetoed bill is "Did not advance" (its row says "Vetoed").
// Keep this file free of imports: tests and Help's data load it outside the page.
export const STANDS = [
  { key: 'hear', word: 'Hearing scheduled', icon: 'calendar',
    means: 'A committee has set a day to hear it, or has just heard it and is deciding.' },
  { key: 'wait', word: 'Waiting for a hearing', icon: 'hourglass',
    means: 'It sits in a committee with no hearing set. If it isn’t heard by the deadline, it can’t pass this year.' },
  { key: 'vote', word: 'Waiting for a vote', icon: 'vote',
    means: 'Its committees passed it. The full House or Senate votes next, or the House and Senate work out one version.' },
  { key: 'passed', word: 'Passed the Legislature', icon: 'landmark',
    means: 'The House and Senate both passed it, and the Governor decides whether to sign it. For a change to the state constitution, the voters decide.' },
  { key: 'law', word: 'Became law', icon: 'circle-check',
    means: 'The Governor signed it, it became law without a signature, or lawmakers overrode a veto.' },
  { key: 'dead', word: 'Did not advance', icon: 'archive',
    means: 'It missed a deadline, was put on hold, or was vetoed and lawmakers did not override the veto. It can’t pass this year.' },
];
// "Moving" (Find's "Moving now", the counts on issue pages): not law yet and still able to become law this year.
export const MOVING = ['hear', 'wait', 'vote', 'passed'];
export const standWord = k => (STANDS.find(s => s.key === k) || {}).word || '';
