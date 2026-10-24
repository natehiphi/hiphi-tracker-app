// The Capitol's action lines in plain words (R-212 #45, DESIGN C-15, C-10): the bill page's "Last official action" and
// "Every official action" say each line through pub/capitol.js, never a committee code ("Referred to HHS/EIG, CPN/JDC.")
// and never the Capitol's jargon ("deferred", "measure", "recommend(s)"). This runs every real line in the practice data
// (demo/snapshot.json: each bill's actions and last action, about 2,500 different lines) and the live tracker's lines the
// practice data has no copy of (the Governor's, a veto, a hold, conference notices) through it, and checks about twenty
// typical ones word for word, with the step names (cmteName) the step line uses.
// Run: node tests/capitol_words_test.mjs  (also one of tools/quick_checks.mjs)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { capitolWords, cmteName, theCmteName, RETIRED } from '../pub/capitol.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const snap = JSON.parse(fs.readFileSync(path.join(ROOT, 'demo', 'snapshot.json'), 'utf8'));
const CM = Object.fromEntries(snap.committees.map(c => [c.code, c]));
const CODES = new Set([...Object.keys(CM), ...Object.keys(RETIRED)]);
const fails = [];
let checked = 0;
const ok = (c, m) => { checked++; if (!c) fails.push(m); };

// Lines from the live tracker (public_all_bills.last_action, 23 Oct 2026) whose kind the practice data has no copy of.
const LIVE = [
  'Act 189, on 07/07/2026 (Gov. Msg. No. 1291).',
  'Became law without the Governor\'s signature, Act 266, 07/16/2026, (Gov. Msg. No. 1370).',
  'Vetoed (Gov. Msg. No. 1369).',
  'Enrolled to Governor.',
  'Referred to HHS/EIG, CPN/JDC.',
  'The committee on JDC deferred the measure.',
  'The committee on WAM deferred the measure.',
  'The committee(s) on  PSM recommend(s) that the measure be HELD.  The votes in PSM were as follows: 3 Aye(s): Senator(s) Fukunaga, Hashimoto, Inouye; Aye(s) with reservations: none ; 0 No(es): none; and 2 Excused: Senator(s) Lee, C., DeCorte.',
  'Received notice of passage on Final Reading in House (Hse. Com. No. 889).',
  'Received notice of appointment of House conferees (Hse. Com. No. 810).',
  'Received notice of the discharge of all House Conferees (Hse. Com. No. 457).',
  'Received notice of all Senate conferees being discharged (Sen. Com. No. 409).',
  'Received notice of change in Senate conferees (Sen. Com. No. 812).',
  'Recommitted to Conference committee as amended in CD 1 with none voting no and Representative(s) Alcos excused.',
  'Report adopted, as amended (SD 1) and recommitted to JDC.',
  'Report adopted, as amended (SD 1) and referred to WAM.',
  'Report adopted, referred to JDC.',
  'Report and Resolution Adopted.',
  'Resolution adopted in final form.',
  'Received notice of Adoption in House (Hse. Com. No. 891).',
  'Received notice of Adoption (Sen. Com. No. 823).',
  'Certified copies of resolutions sent, 05-12-26.',
  'Failed to pass Third Reading with Representative(s) Amato, Grandinetti, Iwamoto, Perruso voting aye with reservations; Representative(s) Belatti, Chun, Cochran, Garrett, Gedeon, Hartsfield, Hashem, Ilagan, Keohokapu-Lee Loy, Kitagawa, Kong, Lee, M., Marten, Matayoshi, Muraoka, Olds, Poepoe, Reyes Oda, Sayama, Souza, Takayama, Takenouchi, Tam, Templo, Yamashita voting no (25) and none excused (0).',
  'Meeting Scheduled on Friday, 01-30-26 11:30AM in conference room 423 VIA VIDEOCONFERENCE has been canceled.',
  'Conference committee meeting to reconvene on 04-29-26 2:30PM; CR 224.',
  'Bill scheduled for Conference Committee Meeting on Wednesday, 04-29-26 3:30PM in conference room 224.',
  'The recommendation was not adopted.',
];
const lines = [...new Set([...snap.activity.map(a => a.title), ...snap.bills.map(b => b.last_action), ...LIVE].filter(Boolean))];

// 1. Every real line: no committee code, none of the Capitol's jargon, no word in capitals.
const bad = [];
for (const t of lines) {
  const out = capitolWords(t, CM), why = [];
  for (const w of out.match(/\b[A-Z]{2,4}\b/g) || []) if (CODES.has(w)) why.push(`the code ${w}`);
  if (/\bdeferred\b/i.test(out)) why.push('"deferred" (C-15: put on hold)');
  if (/\bmeasures?\b/i.test(out)) why.push('"measure"');
  if (/\brecommend/i.test(out)) why.push('"recommend(s)"');
  if (/\b[A-Z]{3,}\b/.test(out)) why.push('a word in capitals');
  if (!out || /undefined|NaN|\$\{/.test(out)) why.push('empty or broken');
  if (why.length) bad.push(`${why.join(', ')}: ${JSON.stringify(t.slice(0, 120))} -> ${JSON.stringify(out.slice(0, 160))}`);
}
ok(!bad.length, `${bad.length} of ${lines.length} real lines still show a code or the Capitol's jargon:\n  ${bad.slice(0, 12).join('\n  ')}`);
checked += lines.length - 1;

// 2. Typical lines, word for word.
const SAME = [
  ['Referred to HHS/EIG, CPN/JDC.', 'Sent to two Senate committees together (Health and Human Services, and Energy and Intergovernmental Affairs), then two more together (Commerce and Consumer Protection, and Judiciary).'],
  ['The committee on JDC deferred the measure.', 'The Senate Judiciary Committee put it on hold.'],
  ['Referred to ECD, CPC, FIN, referral sheet 2', 'Sent to three House committees, one after another: Economic Development & Technology, Consumer Protection & Commerce, and Finance.'],
  ['Referred to CPN.', 'Sent to the Senate Commerce and Consumer Protection Committee.'],
  ['Re-Referred to EIG, CPN/WAM.', 'Sent instead to the Senate Energy and Intergovernmental Affairs Committee, then two more together (Commerce and Consumer Protection, and Ways and Means).'],
  ['Recommitted to JHA/AGR with Representative(s) Amato, Belatti, Cochran, Iwamoto, Perruso, Souza voting no and Representative(s) Ward excused.', 'Sent back to two House committees together: Judiciary & Hawaiian Affairs, and Agriculture & Food Systems.'],
  ['The committee(s) on WLA/PSM has scheduled a public hearing on 03-16-26 3:01PM; Conference Room 016 & Videoconference.', 'Two Senate committees (Water, Land, Culture and the Arts; and Public Safety and Military Affairs) set a hearing for Mon, Mar 16 at 3:01 PM in Room 016 and online.'],
  ['Bill scheduled to be heard by HLT on Wednesday, 01-29-25 10:00AM in House conference room 329 VIA VIDEOCONFERENCE.', 'The House Health Committee set a hearing for Wed, Jan 29 at 10:00 AM in Room 329 and online.'],
  ['The committee(s) on WAM will hold a public decision making on 02-12-25 10:01AM; Conference Room 211 & Videoconference.', 'The Senate Ways and Means Committee set a vote on it for Wed, Feb 12 at 10:01 AM in Room 211 and online.'],
  ['The committee on EDN recommend that the measure be PASSED, WITH AMENDMENTS. The votes were as follows: 11 Ayes: Representative(s) Woodson, La Chica, Amato, Evslin, Garrett, Kapela, Kila, Olds, Sayama, Muraoka, Souza; Ayes with reservations: none;  Noes: none; and  Excused: none.', 'The House Education Committee voted to pass it with changes (11 yes, 0 no).'],
  [LIVE[7], 'The Senate Public Safety and Military Affairs Committee voted to put it on hold (3 yes, 0 no).'],
  ['The committee(s) on HHS deferred the measure until 01-29-25 1:00PM; Conference Room 225 & Videoconference.', 'The Senate Health and Human Services Committee put it on hold until Wed, Jan 29 at 1:00 PM.'],
  ['Reported from LAB (Stand. Com. Rep. No. 10) as amended in HD 1, recommending passage on Second Reading and referral to CPC.', 'The House Labor Committee passed it with changes (House draft 1). Then it goes to the House Consumer Protection & Commerce Committee.'],
  ['Passed Second Reading as amended in HD 1 and referred to the committee(s) on CPC with none voting aye with reservations; Representative(s) Pierick voting no (1) and Representative(s) Cochran, Ward excused (2).', 'Passed a vote of the full House with changes (House draft 1). One member voted no. Then it goes to the House Consumer Protection & Commerce Committee.'],
  ['Report adopted; Passed Second Reading, as amended (SD 1) and referred to WAM.', 'Passed a vote of the full Senate with changes (Senate draft 1). Then it goes to the Senate Ways and Means Committee.'],
  ['Report Adopted; Passed Third Reading, as amended (SD 1).  Ayes, 22; Aye(s) with reservations: none.  Noes, 0 (none).  Excused, 3 (Senator(s) Gabbard, Kouchi, Richards).  Transmitted to House.', 'Passed the Senate with changes (Senate draft 1). The vote: 22 yes, 0 no. Sent to the House.'],
  ['Received from House (Hse. Com. No. 136).', 'Arrived in the Senate from the House.'],
  ['Introduced and Pass First Reading.', 'Introduced and read for the first time.'],
  ['Carried over to 2026 Regular Session.', 'Carried over to the 2026 session.'],
  ['Enrolled to Governor.', 'Sent to the Governor.'],
  ['Act 189, on 07/07/2026 (Gov. Msg. No. 1291).', 'Became law as Act 189 on Jul 7, 2026.'],
  ['Vetoed (Gov. Msg. No. 1369).', 'Vetoed by the Governor.'],
  [LIVE[22], 'Did not pass the full House. 25 members voted no.'],
  // A 2025 committee the 2026 list no longer has is named, not shown as its code.
  ['The committee(s) on TCA deferred the measure until 03-13-25 3:02PM; Conference Room 224 & Videoconference.', 'The Senate Transportation and Culture and the Arts Committee put it on hold until Thu, Mar 13 at 3:02 PM.'],
];
for (const [t, want] of SAME) {
  ok(lines.includes(t), `the expectation's line is a real one from the data: ${JSON.stringify(t.slice(0, 80))}`);
  const got = capitolWords(t, CM);
  ok(got === want, `${JSON.stringify(t.slice(0, 90))}\n     want ${JSON.stringify(want)}\n     got  ${JSON.stringify(got)}`);
}
// "Passed Third Reading." alone does not say where: the activity row's chamber does ("Official action - Senate").
ok(capitolWords('Report adopted; Passed Second Reading.', CM, { chamber: 'H' }) === 'Passed a vote of the full House.', 'a line that does not say its chamber takes the row\'s');
// A line no rule knows keeps its own words, with its committee named and its capitals in normal case (not a real line: no
// real line is left to the fallback today).
ok(capitolWords('The committee(s) on HHS/CPN ADVANCED the measure TODAY.', CM) === 'Two Senate committees (Health and Human Services, and Commerce and Consumer Protection) advanced the bill today.',
  `the fallback: ${capitolWords('The committee(s) on HHS/CPN ADVANCED the measure TODAY.', CM)}`);

// 3. A committee step's name, as the step line and See all steps say it (C-15's joint form).
const NAMES = [
  ['JDC', 'Senate Judiciary Committee'],
  ['HLT', 'House Health Committee'],
  ['HHS/CPN', 'two Senate committees: Health and Human Services, and Commerce and Consumer Protection'],   // C-15's own example
  ['WLA/PSM', 'two Senate committees: Water, Land, Culture and the Arts; and Public Safety and Military Affairs'],
  ['HLT/HSH', 'two House committees: Health, and Human Services & Homelessness'],
  ['JHA/LAB', 'two House committees: Judiciary & Hawaiian Affairs, and Labor'],
  ['AEN/HHS/EDT', 'three Senate committees: Agriculture and Environment, Health and Human Services, and Economic Development and Tourism'],
  ['WTL', 'Senate Water and Land Committee'],
  ['ZZZ', 'the ZZZ committee'],
];
for (const [code, want] of NAMES) ok(cmteName(code, CM) === want, `cmteName(${code}): want ${JSON.stringify(want)}, got ${JSON.stringify(cmteName(code, CM))}`);
ok(theCmteName('JDC', CM) === 'the Senate Judiciary Committee' && theCmteName('HHS/CPN', CM).startsWith('two Senate committees: '), 'theCmteName adds "the" to one committee only');
ok(cmteName('HHS/CPN', CM, { mid: true }) === 'two Senate committees (Health and Human Services, and Commerce and Consumer Protection)', 'inside a sentence, the names go in brackets');
ok(cmteName('HHS/CPN', CM, { link: (k, t) => `<a href="#/committee/${k}">${t}</a>` }) === 'two Senate committees: <a href="#/committee/HHS">Health and Human Services</a>, and <a href="#/committee/CPN">Commerce and Consumer Protection</a>', 'each committee can be linked to its page');
ok(!/^\s*import\b/m.test(fs.readFileSync(path.join(ROOT, 'pub', 'capitol.js'), 'utf8')), 'capitol.js imports nothing (this test loads it outside the page)');

if (fails.length) { console.log(fails.map(f => 'FAIL ' + f).join('\n')); console.log(`\n${fails.length} failed, ${checked - fails.length} passed`); process.exit(1); }
console.log(`capitol words: all ${checked} checks passed (${lines.length} real lines, ${SAME.length} word for word, ${NAMES.length} step names)`);
