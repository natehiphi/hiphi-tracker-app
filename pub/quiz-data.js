// "What kind of advocate are you?" (R-217, a draft for Nate's yes or no): the words and the scoring, with no imports so a
// plain node test can read them (tests/quiz_test.mjs). pub/quiz.js draws them.
//
// The four ways to help are the four groups the profile already asks about (pub/myprofile.js HELP_GROUPS, R-165, Nate
// 10/5): Speak up, Spread the word, Show up, Bring my skills. So what the quiz says matches what HIPHI's team is told.
// Every question has one answer for each of the four, in a different order each time; a tie goes to the last answer.
// There is no right answer and no score (DESIGN.md C-7). The result changes what the person sees next (C-13): its name,
// its words and its one step. Words: grade 8 or lower (C-10), no emoji (A-11), nothing about a party or a candidate.

export const KEYS = ['voice', 'connector', 'shows', 'skill'];

export const QUESTIONS = [
  { q: 'A bill you care about has a hearing on Tuesday. What sounds most like you?', a: [
    ['connector', 'I text a few friends and ask them to speak up too.'],
    ['voice', 'I write down why it matters to me and send it in.'],
    ['shows', 'I go to the hearing and sit in the room.'],
    ['skill', 'I offer what I know or what I’m good at.'] ] },
  { q: 'At a community meeting, you are usually the one who…', a: [
    ['shows', 'Shows up early and stays to the end.'],
    ['skill', 'Says, “I can help with that.”'],
    ['voice', 'Raises a hand and says what they think.'],
    ['connector', 'Introduces people who should know each other.'] ] },
  { q: 'Which would make you proudest?', a: [
    ['voice', 'Someone told me my story changed their mind.'],
    ['connector', 'I got twenty neighbors talking about it.'],
    ['skill', 'My work helped a cause I believe in.'],
    ['shows', 'The hearing room was full of people who care.'] ] },
  { q: 'People come to you when they need…', a: [
    ['skill', 'Someone to fix, translate, design or explain something.'],
    ['shows', 'Someone who will really turn up.'],
    ['connector', 'Someone who knows everyone.'],
    ['voice', 'Someone who will say it straight.'] ] },
  { q: 'You have ten minutes today. What would you rather do?', a: [
    ['voice', 'Write a few honest sentences about why an issue matters.'],
    ['connector', 'Send something to a friend who would care.'],
    ['shows', 'Find out where and when people are gathering.'],
    ['skill', 'Tell a group what I’m good at.'] ] },
];

// Each result: a name, an icon (icons.js), one line, two sentences, and one step. `step.to` is a link, or 'share' for the
// quiz itself. Three steps lead to Find because it is the one place that needs no account, no text and no live bill (the
// profile asks for a phone number or an email first; the Legislature is on break until January).
export const TYPES = {
  voice: { name: 'The Voice', icon: 'megaphone', line: 'You like to say it in your own words.',
    body: 'Your story is one of the strongest things you can bring. A few honest sentences can change how a hearing room listens.',
    step: { label: 'Choose an issue', text: 'Follow the issue you would speak up on. When one of its bills gets a hearing, writing your note takes a few minutes.', to: '#/find' } },
  connector: { name: 'The Connector', icon: 'users', line: 'You get people moving together.',
    body: 'People listen to people they know. When you ask one friend to speak up, you may bring in someone no ad would reach.',
    step: { label: 'Send this to a friend', text: 'Pick one friend who would enjoy it. When they see their result, you have started something.', to: 'share' } },
  shows: { name: 'The One Who Shows Up', icon: 'map-pin', line: 'You are there, in the room.',
    body: 'Hearings are open to everyone. You can go to the Capitol or watch online. Knowing when and where they happen is half the work.',
    step: { label: 'Choose an issue', text: 'Follow an issue you would show up for, then add its hearings to your phone’s calendar.', to: '#/find' } },
  skill: { name: 'The Skill Sharer', icon: 'hand-helping', line: 'You help by doing what you do well.',
    body: 'Translating, writing, designing, organizing and fixing all help a cause. HIPHI’s team can use every one of them.',
    step: { label: 'Choose an issue', text: 'Follow an issue where your skill could help. You’ll hear when its bills get a hearing.', to: '#/find' } },
};

export const SHARE_TEXT = 'HIPHI’s quiz: how would you help with Hawaiʻi’s health laws? Five quick questions, no wrong answers.';
export const INTRO = 'Five quick questions about how you’d help with Hawaiʻi’s health laws. No wrong answers. You get one way to help, and one small step.';

// picks: the chosen key for each question, in order. The most picked wins; a tie goes to the last of the tied keys picked.
export function resultOf(picks) {
  const n = Object.fromEntries(KEYS.map(k => [k, 0]));
  for (const k of picks) if (k in n) n[k]++;
  const top = Math.max(...Object.values(n));
  const tied = KEYS.filter(k => n[k] === top);
  for (let i = picks.length - 1; i >= 0; i--) if (tied.includes(picks[i])) return picks[i];
  return tied[0];
}
