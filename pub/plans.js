// The first visit's five plans under test (R-164, Nate 10/5: "I like plan 1 ... build mockups for the other plans too ...
// These will be offered as different options that we can test"). The plans and why each is shaped as it is: the doc
// "Onboarding: five plans" (https://claude.ai/artifact/9Fa9anaztdBJBS1uSXVbMP). The test is 'onb' in variant.js (six
// versions, a switch for each, backend 136); a browser on today's version never reads this file's flows.
//
// This file is only the shape of each plan: its steps in order, its three named parts at the top, its titles and its
// time promise. It sits on the first wave beside start.js (kernel-only, R-122), so the frame can draw the right step
// before the plans' screens (pub/onb.js, loaded on demand) arrive. Every plan keeps the alerts sign-up in its first visit
// (Nate's answer, 10/5): the step 'join', drawn once for all plans in onb.js.
//
// Steps the plans share with today's: 'topics' (the six tiles; words per plan below) and 'you' (the street address). The
// rest are new, and the private counts accept them (backend 136): one, hello, join, wrap, story, road, island, way,
// first, picks.
//   p1  Start with one bill   topics -> one (a bill that needs voices this week, and the two-minute email to its
//                             chair) -> join -> wrap. Between sessions: topics -> you (find your two legislators)
//                             -> hello (say hello to them) -> join -> wrap.
//   p2  A bill's journey      story (a real bill's road, six scenes, a practice note) -> topics -> road (their issues'
//                             bills on the same road, follow with a tap) -> join -> wrap.
//   p3  Meet your people      island -> you (find your two legislators) -> topics -> picks -> join -> hello -> wrap
//                             (with a note from a HIPHI person).
//   p4  How you like to help  way (four ways, any number) -> topics -> picks -> join -> first (a first step sized to
//                             the way) -> wrap.
//   p5  A light start         topics -> picks (three issues followed for you, each with an untick) -> join -> wrap; the
//                             rest comes one card per later visit on Home (onb.js laterCard).
export const PLAN_FLOWS = {
  p1: { in: ['topics', 'one', 'join', 'wrap'], off: ['topics', 'you', 'hello', 'join', 'wrap'] },
  p2: { in: ['story', 'topics', 'road', 'join', 'wrap'] },
  p3: { in: ['island', 'you', 'topics', 'picks', 'join', 'hello', 'wrap'] },
  p4: { in: ['way', 'topics', 'picks', 'join', 'first', 'wrap'] },
  p5: { in: ['topics', 'picks', 'join', 'wrap'] },
};
export const planFlow = (p, off) => (off && PLAN_FLOWS[p]?.off) || PLAN_FLOWS[p]?.in || [];
// The steps onb.js draws (the others are today's: 'topics' in start.js, 'you' in start-rest.js).
export const PLAN_STEPS = ['one', 'hello', 'join', 'wrap', 'story', 'road', 'island', 'way', 'first', 'picks'];

// The three named parts at the top of each plan (a signpost, not controls, as today's). The ending ('wrap') is past the
// last part, so all three show as done there.
export const PLAN_CHAPTERS = {
  p1: ['Your issue', 'Your voice', 'Stay in the loop'],
  p2: ['A bill’s journey', 'Your issues', 'Stay in the loop'],
  p3: ['Who speaks for you', 'Your issues', 'Say aloha'],
  p4: ['Your way', 'Your issues', 'Your first step'],
  p5: ['Your issues', 'Stay in the loop'],
};
export const PLAN_CHAPTER_OF = {
  p1: { topics: 0, one: 1, you: 1, hello: 1, join: 2, wrap: 3 },
  p2: { story: 0, topics: 1, road: 1, join: 2, wrap: 3 },
  p3: { island: 0, you: 0, topics: 1, picks: 1, join: 1, hello: 2, wrap: 3 },
  p4: { way: 0, topics: 1, picks: 1, join: 1, first: 2, wrap: 3 },
  p5: { topics: 0, picks: 0, join: 1, wrap: 2 },
};
export const PLAN_TITLES = {
  one: 'One bill that needs voices', hello: 'Say aloha to your legislators', join: 'Stay in the loop', wrap: 'You’re all set',
  story: 'A bill’s journey', road: 'Your issues on the road', island: 'Where do you live?', way: 'How do you like to help?',
  first: 'Your first step', picks: 'What’s moving on your issues',
};
// The time promise on the first screen, kept by each plan's length (the doc's table).
// Honest for each plan's length (the review, 10/5: seven steps with an address and an email are not "2 minutes").
export const PLAN_SURE = { p1: 'About 3 minutes. Free.', p2: 'About 3 minutes. Free.', p3: 'About 3 minutes. Free.', p4: 'About 2 minutes. Free.', p5: 'Under a minute. Free.' };

// The topics screen's words in each plan (start.js stepTopics): the heading and the line under it, in session and between
// sessions. {open} is the day the session opens.
export const PLAN_TOPICS = {
  p1: { h: 'Speak up for a healthier Hawaiʻi', lede: 'HIPHI follows the health bills at the Hawaiʻi Legislature. Pick what you care about, and we’ll keep watch on it. Then we’ll show you one bill that needs voices this week.',
    hOff: 'Get ready for the {next} session', ledeOff: 'The Legislature opens {open}. Pick what you care about, and we’ll keep watch on it. Then say hello to the two people who vote for you there.' },
  // Said so it reads right whether or not the person watched the story (Plan 2's helper: after "Skip to the bills",
  // "That road" pointed at nothing).
  p2: { h: 'What do you care about?', lede: 'Pick what you care about, and we’ll show you where its bills are on the road to becoming law.',
    ledeOff: 'The session opens {open}. Pick what you care about, and we’ll show you where its bills ended up this year.' },
  p3: { h: 'What should they hear about from you?', lede: 'Pick what you care about. We’ll show you what your legislators will decide on it.' },
  p4: { h: 'What do you care about?', lede: 'Pick what you care about. We’ll find your first step on it, sized to how you like to help.' },
  p5: { h: 'Speak up for a healthier Hawaiʻi', lede: 'HIPHI follows the health bills at the Hawaiʻi Legislature. Pick what you care about. That’s most of it: we’ll keep watch for you.',
    hOff: 'Get ready for the {next} session', ledeOff: 'The Legislature opens {open}. Pick what you care about, and we’ll keep watch for you.' },
};
