// "I'm a..." (R-147): the agreed list and the rule that picks a letter's title (pub/titles.js). No server needed.
//   node tests/titles_test.mjs
import * as T from '../pub/titles.js';
let pass = 0, fail = 0; const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); c ? pass++ : fail++; };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// The agreed list (Nate 10/4: "Yes to the list"): shown first, the rest in five groups, every key unique. Since R-165 the
// two kinds of student are shown first as plain titles (the "student" choice that opened two more was clunky).
ok(eq(T.FIRST.map(t => t.k), ['parent', 'kupuna', 'student-hs', 'student-college', 'teacher', 'nurse', 'doctor', 'business', 'volunteer']), 'the nine shown first, both kinds of student among them');
ok(new Set(T.TITLES.map(t => t.k)).size === T.TITLES.length, 'every key is unique');
ok(T.GROUPS.map(([g]) => g).join() === 'family,health,school,work,community' && T.GROUPS.every(([g]) => T.inGroup(g).length > 0), 'five groups behind "More titles", none empty');
ok(!T.GROUPS.some(([g]) => T.inGroup(g).some(t => /^student/.test(t.k))), 'the students are not listed twice');
ok(T.TITLES.filter(t => t.self).map(t => t.k).sort().join() === 'board,faith,nonprofit,public-health', '"writing for myself" after the four agreed titles only');
ok(!T.TITLES.some(t => /(race|religio|immigra|disab|health condition|snap|recovery)/i.test(t.say)), 'nothing sensitive about the writer goes in a letter (left to their own words)');
ok(T.TITLES.every(t => t.pick || /^[a-zʻ]/.test(t.say)), 'every title reads in "As a ___" (a plain lowercase noun)');

// One title by default, the one that fits the bill best (R-165, Nate 10/5: "The app should default to one").
const mine = ['bus-rider', 'parent', 'nurse', 'teacher'];
ok(eq(T.pickTitle(mine, { cats: ['food'], text: 'Free school meals for every student' }), ['parent']), 'school meals: parent');
ok(eq(T.pickTitle(mine, { cats: ['around'], text: 'Free bus rides for kids' }), ['bus-rider']), 'free bus rides for kids: bus rider (named and on the topic)');
ok(eq(T.pickTitle(mine, { cats: ['tobacco'], text: 'Disposable e-cigarette ban' }), ['nurse']), 'an e-cigarette ban: nurse');
ok(eq(T.pickTitle(['volunteer', 'organizer', 'renter'], { cats: ['climate'], text: 'Ban the pesticide Telone' }), ['volunteer']), 'nothing fits: their first title');
ok(eq(T.pickTitle(['renter', 'own:youth soccer coach'], { cats: ['tobacco'], text: 'Youth substance misuse prevention funds' }), ['own:youth soccer coach']), 'their own words count when a word of theirs is in the bill');
ok(eq(T.pickTitle(['teacher', 'parent'], {}), ['teacher']), 'nothing known about the bill: their first title');
ok(eq(T.pickTitle([], { text: 'x' }), []), 'no titles: none');

// The letter's words.
ok(T.withTitles(['parent', 'teacher'], 'I support HB 1523.') === 'As a parent and teacher, I support HB 1523.', 'As a parent and teacher, I support...');
ok(T.withTitles(['kupuna', 'faith'], 'I strongly oppose SB 2.') === 'As a kupuna and faith leader, writing for myself, I strongly oppose SB 2.', '"writing for myself" after a faith leader');
ok(T.withTitles(['own:EMT'], 'I oppose SB 1.') === 'As an EMT, I oppose SB 1.' && T.withTitles(['own:UH professor'], 'I oppose SB 1.') === 'As a UH professor, I oppose SB 1.', 'a or an by sound for abbreviations');
ok(T.withTitles([], 'I support HB 1.') === 'I support HB 1.', 'no titles: the sentence as it was');
ok(T.aWords(['nurse', 'board']) === 'a nurse and neighborhood board member', '"a nurse and neighborhood board member" for the introduction');
ok(T.withTitles(['parent', 'teacher', 'coach'], 'I support HB 1.') === 'As a parent, teacher and coach or youth leader, I support HB 1.', 'three or more read as a list (R-165: as many as they like)');

// Typing: suggestions, own words, cleaning.
ok(eq(T.findTitles('coa').map(t => t.k), ['coach']), '"coa" finds coach or youth leader');
ok(eq(T.findTitles('stud').map(t => t.k), ['student-hs', 'student-college']), '"stud" finds both kinds of student');
ok(T.findTitles('teach', ['teacher']).length === 0, 'a title already picked is not suggested again');
ok(eq(T.cleanTitles(['parent', 'own:  youth   coach ', 'gone-key', 'student', 'PARENT', 'own:Youth Coach', 'own:<b>x</b>']), ['parent', 'own:youth coach', 'own:bx/b']), 'cleaning: repeats, unknown keys, the bare student choice and <> go');
ok(eq(T.cleanTitles(['own:Teacher', 'teacher', 'own:kupuna (older adult)', 'own:Student']), ['teacher', 'kupuna', 'own:Student']), 'own words that are a list title become that title (the bare "student" stays theirs) (R-156)');
ok(T.listKeyFor('  Teacher  ') === 'teacher' && T.listKeyFor('teacher (kumu)') === 'teacher' && T.listKeyFor('youth soccer coach') === '', 'listKeyFor: a list title by its words, else nothing');
ok(!T.TITLES.some(t => /vap/i.test(t.say + t.label + (t.words ? t.words.source : ''))), 'no "vape" wording (e-cigarettes, R-158)');
ok(T.cleanTitles(Array.from({ length: 14 }, (_, i) => 'own:t' + i)).length === T.TITLES_MAX, `at most ${T.TITLES_MAX} titles`);
ok(T.ownKey('x'.repeat(60)).length === 4 + T.OWN_MAX, `own words are cut at ${T.OWN_MAX} characters`);

console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
