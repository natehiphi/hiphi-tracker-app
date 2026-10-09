// "What kind of advocate are you?" (R-217, a draft): the words and the scoring in pub/quiz-data.js, checked with no browser.
// node tests/quiz_test.mjs
import { KEYS, QUESTIONS, TYPES, SHARE_TEXT, INTRO, resultOf } from '../pub/quiz-data.js';
import { ICONS } from '../icons.js';

let ok = 0, fail = 0;
const check = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); c ? ok++ : fail++; };
const words = [SHARE_TEXT, INTRO, ...QUESTIONS.flatMap(q => [q.q, ...q.a.map(a => a[1])]),
  ...Object.values(TYPES).flatMap(t => [t.name, t.line, t.body, t.step.label, t.step.text])];

// 1. The shape: five questions, one answer for each of the four ways to help, in no fixed order; four results.
check(QUESTIONS.length === 5, 'five questions');
check(QUESTIONS.every(q => q.a.length === 4 && KEYS.every(k => q.a.filter(a => a[0] === k).length === 1)), 'every question has exactly one answer for each of the four ways to help');
const orders = new Set(QUESTIONS.map(q => q.a.map(a => a[0]).join()));
check(orders.size === QUESTIONS.length, 'the order of the answers differs on every question (no pattern to learn)');
check(KEYS.every(k => TYPES[k] && TYPES[k].name && TYPES[k].line && TYPES[k].body && TYPES[k].step.label && TYPES[k].step.text && TYPES[k].step.to), 'every result has a name, a line, a body and one step');
check(KEYS.every(k => ICONS[TYPES[k].icon]), 'every result icon exists in icons.js');
check(KEYS.filter(k => TYPES[k].step.to === 'share').length === 1 && KEYS.filter(k => TYPES[k].step.to === '#/find').length === 3, 'one step is "send it to a friend", the others open Find (no account, no text, no live bill needed)');

// 2. The scoring.
for (const k of KEYS) check(resultOf(Array(5).fill(k)) === k, `five "${k}" answers give ${k}`);
check(resultOf(['voice', 'voice', 'connector', 'connector', 'voice']) === 'voice', 'the most picked wins (3 to 2)');
check(resultOf(['voice', 'connector', 'voice', 'connector', 'shows']) === 'connector', 'a tie goes to the tied way picked last (voice and connector, 2 each: connector came later)');
check(resultOf(['voice', 'connector', 'shows', 'skill', 'shows']) === 'shows', 'the most picked wins (2 to 1)');
check(resultOf(['voice', 'connector', 'shows', 'skill', 'skill']) === 'skill', 'a pick that leads with a tie of one each still ends on the last pick when nothing else repeats');
// every possible quiz (4^5 = 1024): each result should come up about a quarter of the time (no way to help is favoured)
const tally = Object.fromEntries(KEYS.map(k => [k, 0])); let total = 0;
for (let n = 0; n < 1024; n++) { const picks = []; for (let q = 0, m = n; q < 5; q++, m = Math.floor(m / 4)) picks.push(QUESTIONS[q].a[m % 4][0]); tally[resultOf(picks)]++; total++; }
check(KEYS.every(k => tally[k] / total > 0.2 && tally[k] / total < 0.3), `across all ${total} possible quizzes each result comes up 20% to 30% of the time (${KEYS.map(k => k + ' ' + Math.round(100 * tally[k] / total) + '%').join(', ')})`);

// 3. The words (DESIGN.md A-11, C-10, C-15; R-158; backend CLAUDE.md style).
check(!words.some(w => /\p{Extended_Pictographic}/u.test(w)), 'no emoji (A-11)');
check(!words.some(w => /\bvap(e|es|ing)\b/i.test(w)), 'no "vape" (R-158)');
check(!words.some(w => /\b(dead|died|dies)\b/i.test(w)), 'no "dead" or "died" (C-15)');
check(!words.some(w => /[–—]/.test(w)), 'no em or en dash');
check(!words.some(w => /\bHawaii\b/.test(w)), 'Hawaiʻi is never written without its ʻokina');
check(/HIPHI/.test(SHARE_TEXT) && /Hawaiʻi/.test(SHARE_TEXT) && /Hawaiʻi/.test(INTRO), 'the message a friend gets, and the start, say who is asking and what it is about (C-11)');
check(!words.some(w => /\b(Democrat|Republican|vote for|election|candidate|party)\b/i.test(w)), 'nothing about a party, a candidate or an election (the quiz is about how to help, not what to believe)');
check(!words.some(w => /\b(score|points|winner|right answer)\b/i.test(w) || /(?<!no )\bwrong\b/i.test(w)), 'no score and no right or wrong, except to say there are no wrong answers (C-7)');
check(words.every(w => w.length <= 140), 'every line is short enough to read on a phone at a glance (140 characters)');

console.log(`${ok}/${ok + fail} passed`); process.exit(fail ? 1 : 0);
