// The Capitol's action lines in plain words (R-212 #45, DESIGN C-15, C-10): the bill page's "Last official action" and
// "Every official action" say each line through pub/capitol.js, never a committee code ("Referred to HHS/EIG, CPN/JDC.")
// and never the Capitol's jargon ("deferred", "measure", "recommend(s)"). This runs every real line in the practice data
// (demo/snapshot.json: each bill's actions and last action, about 2,500 different lines) and the live tracker's lines the
// practice data has no copy of (the Governor's, a veto, a hold, conference notices) through it, and checks about twenty
// typical ones word for word, with the two ways a committee step is named (C-15): inside a sentence each name ends with
// "Committee" (theCmteName), and on its own committees heard together are stacked one per line (cmteStack). Also the day
// order of actions the Capitol dates without a time (actionRank).
// Run: node tests/capitol_words_test.mjs  (also one of tools/quick_checks.mjs)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { capitolWords, cmteName, theCmteName, cmteStack, actionRank, RETIRED } from '../pub/capitol.js';

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
  // R-212 #45, the critic: each name ends with "Committee", so "Health and Human Services" never runs into the next name.
  ['Referred to HHS/EIG, CPN/JDC.', 'Sent to the Senate Health and Human Services Committee and the Energy and Intergovernmental Affairs Committee, together, then the Commerce and Consumer Protection Committee and the Judiciary Committee, together.'],
  ['The committee on JDC deferred the measure.', 'The Senate Judiciary Committee put it on hold.'],
  ['Referred to ECD, CPC, FIN, referral sheet 2', 'Sent to the House Economic Development & Technology Committee, then the Consumer Protection & Commerce Committee, then the Finance Committee.'],
  ['Referred to CPN.', 'Sent to the Senate Commerce and Consumer Protection Committee.'],
  ['Re-Referred to EIG, CPN/WAM.', 'Sent instead to the Senate Energy and Intergovernmental Affairs Committee, then the Commerce and Consumer Protection Committee and the Ways and Means Committee, together.'],
  ['Recommitted to JHA/AGR with Representative(s) Amato, Belatti, Cochran, Iwamoto, Perruso, Souza voting no and Representative(s) Ward excused.', 'Sent back to the House Judiciary & Hawaiian Affairs Committee and the Agriculture & Food Systems Committee, together.'],
  ['The committee(s) on WLA/PSM has scheduled a public hearing on 03-16-26 3:01PM; Conference Room 016 & Videoconference.', 'The Senate Water, Land, Culture and the Arts Committee and the Public Safety and Military Affairs Committee set a hearing for Mon, Mar 16 at 3:01 PM in Room 016 and online.'],
  ['Bill scheduled to be heard by HLT on Wednesday, 01-29-25 10:00AM in House conference room 329 VIA VIDEOCONFERENCE.', 'The House Health Committee set a hearing for Wed, Jan 29 at 10:00 AM in Room 329 and online.'],
  ['The committee(s) on WAM will hold a public decision making on 02-12-25 10:01AM; Conference Room 211 & Videoconference.', 'The Senate Ways and Means Committee set a vote on it for Wed, Feb 12 at 10:01 AM in Room 211 and online.'],
  ['The committee on EDN recommend that the measure be PASSED, WITH AMENDMENTS. The votes were as follows: 11 Ayes: Representative(s) Woodson, La Chica, Amato, Evslin, Garrett, Kapela, Kila, Olds, Sayama, Muraoka, Souza; Ayes with reservations: none;  Noes: none; and  Excused: none.', 'The House Education Committee voted to pass it with changes (11 yes, 0 no).'],
  [LIVE[7], 'The Senate Public Safety and Military Affairs Committee voted to put it on hold (3 yes, 0 no).'],
  ['The committee(s) on HHS deferred the measure until 01-29-25 1:00PM; Conference Room 225 & Videoconference.', 'The Senate Health and Human Services Committee put it on hold until Wed, Jan 29 at 1:00 PM.'],
  // The report says only what the committee asks; where it goes next is said once, by the full chamber's vote after it.
  ['Reported from LAB (Stand. Com. Rep. No. 10) as amended in HD 1, recommending passage on Second Reading and referral to CPC.', 'The House Labor Committee filed its report: pass it with changes (House draft 1).'],
  // Second reading moves it on; only third reading "passed the House" (the critic: "Passed a vote of the full House" read as passed).
  ['Passed Second Reading as amended in HD 1 and referred to the committee(s) on CPC with none voting aye with reservations; Representative(s) Pierick voting no (1) and Representative(s) Cochran, Ward excused (2).', 'The full House agreed to move it on (House draft 1). One member voted no. Next: the House Consumer Protection & Commerce Committee.'],
  ['Report adopted; Passed Second Reading, as amended (SD 1) and referred to WAM.', 'The full Senate agreed to move it on (Senate draft 1). Next: the Senate Ways and Means Committee.'],
  ['Report adopted; referred to the committee(s) on FIN with none voting aye with reservations; none voting no (0) and Representative(s) Cochran, Ward excused (2).', 'The full House agreed with the committee. No one voted no. Next: the House Finance Committee.'],
  ['Report Adopted; Passed Third Reading, as amended (SD 1).  Ayes, 22; Aye(s) with reservations: none.  Noes, 0 (none).  Excused, 3 (Senator(s) Gabbard, Kouchi, Richards).  Transmitted to House.', 'Passed the Senate with changes (Senate draft 1). The vote: 22 yes, 0 no. Sent to the House.'],
  ['Received from House (Hse. Com. No. 136).', 'Arrived in the Senate from the House.'],
  ['Introduced and Pass First Reading.', 'Introduced and formally taken up (its first reading).'],
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
// A line that does not say where it happened takes the activity row's chamber ("Official action - Senate").
ok(capitolWords('Report adopted; Passed Second Reading.', CM, { chamber: 'H' }) === 'The full House agreed to move it on.', 'a line that does not say its chamber takes the row\'s');
ok(capitolWords('Passed First Reading.', CM, { chamber: 'S' }) === 'The Senate formally took it up (its first reading).', `a bare first reading: ${capitolWords('Passed First Reading.', CM, { chamber: 'S' })}`);
// "Passed" is said only for the vote that passes a chamber (third reading), never for second reading or a report.
const passedWrong = lines.filter(t => /^(Report adopted[;,] )?(Passed Second Reading|referred)/i.test(t)).map(t => capitolWords(t, CM)).filter(o => /^Passed|passed a vote/i.test(o));
ok(!passedWrong.length, `second reading never says "Passed": ${passedWrong.slice(0, 3).join(' | ')}`);
// A committee's report never says where it goes next (the vote after it does).
const reportNext = lines.filter(t => /^Reported from/i.test(t)).map(t => capitolWords(t, CM)).filter(o => /Next:|Then it goes/.test(o));
ok(!reportNext.length, `a report does not say where it goes next: ${reportNext.slice(0, 2).join(' | ')}`);
// A line no rule knows keeps its own words, with its committee named and its capitals in normal case (not a real line: no
// real line is left to the fallback today).
ok(capitolWords('The committee(s) on HHS/CPN ADVANCED the measure TODAY.', CM) === 'The Senate Health and Human Services Committee and the Commerce and Consumer Protection Committee advanced the bill today.',
  `the fallback: ${capitolWords('The committee(s) on HHS/CPN ADVANCED the measure TODAY.', CM)}`);

// 3. A committee step's name (C-15). In a sentence each name ends with "Committee" and the chamber is said once; on its own,
// committees heard together are a head and one name per line. "Health, and Human Services & Homelessness" (the old joint
// form) was a comma away from the Senate's Health and Human Services Committee.
const NAMES = [
  ['JDC', 'the Senate Judiciary Committee'],
  ['HLT', 'the House Health Committee'],
  ['HHS/CPN', 'the Senate Health and Human Services Committee and the Commerce and Consumer Protection Committee, together'],   // C-15's own example
  ['HLT/HSH', 'the House Health Committee and the Human Services & Homelessness Committee, together'],
  ['WLA/PSM', 'the Senate Water, Land, Culture and the Arts Committee and the Public Safety and Military Affairs Committee, together'],
  ['AEN/HHS/EDT', 'the Senate Agriculture and Environment Committee, the Health and Human Services Committee and the Economic Development and Tourism Committee, together'],
  ['WTL', 'the Senate Water and Land Committee'],
  ['ZZZ', 'the ZZZ committee'],
];
for (const [code, want] of NAMES) ok(theCmteName(code, CM) === want, `theCmteName(${code}): want ${JSON.stringify(want)}, got ${JSON.stringify(theCmteName(code, CM))}`);
ok(cmteName('JDC', CM) === 'Senate Judiciary Committee' && theCmteName('HLT/HSH', CM, { together: false }) === 'the House Health Committee and the Human Services & Homelessness Committee',
  'standing alone it drops "the"; as a subject it drops ", together"');
ok(theCmteName('CPN/WAM', CM, { chamber: false }) === 'the Commerce and Consumer Protection Committee and the Ways and Means Committee, together', 'a later stop leaves its chamber out');
const st = cmteStack('HLT/HSH', CM);
ok(st && st.head === 'two House committees, together' && st.names.map(n => n.name).join('|') === 'Health|Human Services & Homelessness' && st.names.every(n => n.code && n.known),
  `stacked: a head and one name per line (${JSON.stringify(st)})`);
ok(cmteStack('JDC', CM) === null && cmteStack('AEN/HHS/EDT', CM).head === 'three Senate committees, together', 'one committee is not stacked; three are');
// Every joint referral in the practice data reads apart in both forms: no name runs into the next.
const joints = [...new Set(snap.bills.flatMap(b => b.referrals || []).filter(r => r.includes('/')))];
const runOn = joints.filter(c => !new RegExp(`^the (House|Senate) .+ Committee( and the .+ Committee|, the .+ Committee)+, together$`).test(theCmteName(c, CM)) || cmteStack(c, CM).names.length !== c.split('/').length);
ok(joints.length > 50 && !runOn.length, `all ${joints.length} joint referrals are said apart (${runOn.slice(0, 3)})`);

// 4. A day's actions in the order they happen (the Capitol dates them without a time): arrived, first reading, sent to
// committees, hearing set, the committee's vote, its report, the full chamber's vote, sent on, the Governor.
const DAY = ['Received from House (Hse. Com. No. 168).', 'Passed First Reading.', 'Referred to WLA/PSM, WAM/JDC.',
  'The committee(s) on WLA/PSM has scheduled a public hearing on 03-16-26 3:01PM; Conference Room 016 & Videoconference.',
  'The committee on FIN recommend that the measure be PASSED, UNAMENDED. The votes were as follows: 16 Ayes: Representative(s) Todd; Noes: none.',
  'Reported from FIN (Stand. Com. Rep. No. 971-26), recommending passage on Third Reading.',
  'Report adopted; referred to the committee(s) on FIN with none voting aye with reservations; none voting no (0) and none excused (0).',
  'Passed Third Reading with none voting aye with reservations; none voting no (0) and none excused (0).  Transmitted to Senate.', 'Enrolled to Governor.', 'Act 189, on 07/07/2026 (Gov. Msg. No. 1291).'];
const ranks = DAY.map(actionRank);
ok(ranks.every((r, i) => !i || r > ranks[i - 1]), `actionRank puts a day in order (${ranks})`);
ok(actionRank('Introduced and Pass First Reading.') === actionRank('Passed First Reading.') && actionRank('Report adopted; Passed Second Reading, as amended (SD 1) and referred to WAM.') > actionRank('Reported from WAM (Stand. Com. Rep. No. 1).'),
  'the full chamber\'s vote comes after the report it votes on');
ok(!/^\s*import\b/m.test(fs.readFileSync(path.join(ROOT, 'pub', 'capitol.js'), 'utf8')), 'capitol.js imports nothing (this test loads it outside the page)');

if (fails.length) { console.log(fails.map(f => 'FAIL ' + f).join('\n')); console.log(`\n${fails.length} failed, ${checked - fails.length} passed`); process.exit(1); }
console.log(`capitol words: all ${checked} checks passed (${lines.length} real lines, ${SAME.length} word for word, ${NAMES.length} committee names, ${joints.length} joint referrals, a day's order)`);
