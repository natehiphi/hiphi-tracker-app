// "I'm a..." (R-147): the agreed list and the rules that pick a letter's two titles (pub/titles.js). No server needed.
//   node tests/titles_test.mjs
import * as T from '../pub/titles.js';
let pass = 0, fail = 0; const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); c ? pass++ : fail++; };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// The agreed list (Nate 10/4: "Yes to the list"): eight shown first, the rest in five groups, every key unique.
ok(eq(T.FIRST.map(t => t.k), ['parent', 'kupuna', 'student', 'teacher', 'nurse', 'doctor', 'business', 'volunteer']), 'the eight shown first, in the agreed order');
ok(new Set(T.TITLES.map(t => t.k)).size === T.TITLES.length, 'every key is unique');
ok(T.GROUPS.map(([g]) => g).join() === 'family,health,school,work,community' && T.GROUPS.every(([g]) => T.inGroup(g).length > 0), 'five groups behind "More titles", none empty');
ok(T.TITLES.filter(t => t.self).map(t => t.k).sort().join() === 'board,faith,nonprofit,public-health', '"writing for myself" after the four agreed titles only');
ok(!T.TITLES.some(t => /(race|religio|immigra|disab|health condition|snap|recovery)/i.test(t.say)), 'nothing sensitive about the writer goes in a letter (left to their own words)');
ok(T.TITLES.every(t => t.pick || /^[a-zʻ]/.test(t.say)), 'every title reads in "As a ___" (a plain lowercase noun)');

// Picking two that fit the bill (Nate 10/4: "the most relevant ones for the bill if possible").
const mine = ['bus-rider', 'parent', 'nurse', 'teacher'];
ok(eq(T.pickTwo(mine, { cats: ['food'], text: 'Free school meals for every student' }), ['parent', 'teacher']), 'school meals: parent and teacher');
ok(eq(T.pickTwo(mine, { cats: ['around'], text: 'Free bus rides for kids' }), ['bus-rider', 'parent']), 'free bus rides for kids: bus rider and parent');
ok(eq(T.pickTwo(mine, { cats: ['tobacco'], text: 'Disposable e-cigarette ban' }), ['nurse']), 'an e-cigarette ban: nurse alone (a parent only shares the topic; R-156 the review)');
ok(eq(T.pickTwo(mine, { cats: ['tobacco'], text: 'Disposable e-cigarette ban for kids' }), ['parent', 'nurse']), 'an e-cigarette ban for kids: parent and nurse (both named by the bill)');
ok(eq(T.pickTwo(['volunteer', 'organizer', 'renter'], { cats: ['climate'], text: 'Ban the pesticide Telone' }), ['volunteer']), 'nothing fits: their first title alone (R-156)');
ok(eq(T.pickTwo(['teacher', 'nurse'], { cats: ['food'], text: 'school meals' }), ['teacher']), 'a second title that only shares the topic is left out (R-156)');
ok(eq(T.pickTwo(['parent', 'own:youth soccer coach', 'renter'], { cats: ['tobacco'], text: 'Youth substance misuse prevention funds' }), ['parent', 'own:youth soccer coach']), 'their own words count when a word of theirs is in the bill');
ok(eq(T.pickTwo(['teacher', 'parent'], {}), ['teacher']), 'nothing known about the bill: their first title');

// The letter's words.
ok(T.withTitles(['parent', 'teacher'], 'I support HB 1523.') === 'As a parent and teacher, I support HB 1523.', 'As a parent and teacher, I support...');
ok(T.withTitles(['kupuna', 'faith'], 'I strongly oppose SB 2.') === 'As a kupuna and faith leader, writing for myself, I strongly oppose SB 2.', '"writing for myself" after a faith leader');
ok(T.withTitles(['own:EMT'], 'I oppose SB 1.') === 'As an EMT, I oppose SB 1.' && T.withTitles(['own:UH professor'], 'I oppose SB 1.') === 'As a UH professor, I oppose SB 1.', 'a or an by sound for abbreviations');
ok(T.withTitles([], 'I support HB 1.') === 'I support HB 1.', 'no titles: the sentence as it was');
ok(T.aWords(['nurse', 'board']) === 'a nurse and neighborhood board member', '"a nurse and neighborhood board member" for the introduction');

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
