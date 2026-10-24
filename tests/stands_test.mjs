// Where a bill stands, in six words, written once (R-212 #44, DESIGN C-15): pub/stands.js holds the words and what each
// means; All bills' groups, Find's and My issues' counts and Help's answer all come from it. This check fails when a
// screen writes its own copy of the words or its own rule again, or when Help's answer drifts from the list.
// Run: node tests/stands_test.mjs  (also one of tools/quick_checks.mjs)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { STANDS, MOVING, standWord } from '../pub/stands.js';
import { TALKS } from '../pub/talk-data.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); };

// The list itself
const keys = STANDS.map(s => s.key);
ok(keys.join() === 'hear,wait,vote,passed,law,dead', `six stands in hearing order (${keys})`);
ok(STANDS.every(s => s.word && s.means && s.icon), 'each stand has a word, a meaning and an icon');
ok(new Set(STANDS.map(s => s.word)).size === 6, 'six different words');
ok(MOVING.join() === 'hear,wait,vote,passed', 'moving = not law yet and still able to pass');
ok(standWord('dead') === 'Did not advance', 'C-15: a bill out for the year "did not advance"');
ok(STANDS.every(s => !/this session|stopped|dead\b|died/i.test(s.word + ' ' + s.means)), 'C-15 words: "this year", never "this session", "stopped" or "dead"');
ok(STANDS.every(s => (s.means.match(/[.!?](\s|$)/g) || []).length <= 2), 'each meaning is one or two sentences (Help shows two per answer)');
ok(!/^\s*import\b/m.test(src('pub/stands.js')), 'stands.js imports nothing (tests and Help load it outside the page)');

// Help explains exactly these words
const t = TALKS.find(x => x.slug === 'where-a-bill-stands');
ok(t && t.group === 'words', 'Help has "where-a-bill-stands" under "Words you\'ll see"');
const said = t ? t.turns.flatMap(u => [].concat(u.a)).join(' ') : '';
for (const s of STANDS) ok(said.includes(`**${s.word}:** ${s.means}`), `Help says "${s.word}" with its meaning`);

// The screens use the list and the one rule, not copies
const ab = src('pub/allbills.js'), mb = src('pub/mybills.js'), core = src('pub/core.js');
ok(/STANDS\.map\(s => \[s\.key, s\.word\]\)/.test(ab), 'All bills names its groups from STANDS');
ok(/const groupOf = b => standRule\(b\)/.test(ab), 'All bills groups bills by core standOf');
ok(!/'Passed the Legislature'|'Waiting for a vote'|'Hearing scheduled'/.test(ab), 'All bills writes no group word of its own');
ok(/#\/help\/where-a-bill-stands/.test(ab), 'All bills links to what the groups mean');
ok(/export const moving = b => MOVING\.includes\(endOf\(b\)/.test(mb), "Find's and My issues' moving comes from the one rule");
ok(!/alive\(b\) \|\| b\.stage === 'governor'/.test(mb), "My issues has no rule of its own for moving (it left out the voters' amendments)");
ok(/export const endOf = b =>/.test(core) && /export function standOf\(b\)/.test(core), 'core.js has endOf and standOf');
ok(/b\.stage === 'governor' \|\| b\.stage === 'ballot' \? 'passed'/.test(core), 'a bill sent to the Governor or the voters has passed the Legislature');
ok(!/STAGE_PLAIN/.test(core), 'no second, unused list of stage words in core.js');

if (fails.length) { console.log(fails.map(f => 'FAIL ' + f).join('\n')); process.exit(1); }
console.log(`stands: all passed (${STANDS.length} words, Help, All bills, My issues)`);
