// The share picture versions (R-183): before any goes live, every bill's pictures for every version that fits are worked out
// and checked against the same readings the card's title uses, so none shows a wrong date, step, committee, chair or side.
//   node tests/share_pics_test.mjs
// Every bill of the practice copy (734, at its day, 16 Mar 2026) is checked as it stands and as if it were at each later stage
// (on the floor of either chamber, in conference, at the Governor's desk, a law, stopped), since the practice day has few of
// those; the live site's bills are the same shape. Offline: the snapshot and the issues' draft words are in the repository.
import { readFileSync, existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { billState, asksFor, cardFor, committeeWords, dayWords, timeWords } from '../tools/share_cards.mjs';
import { demoSets, wordsMap } from '../tools/share_pic_data.mjs';
import { ARMS, ARM_NAMES, specsFor, specKey, picPath, titleCase, loadLooks, roadNode, roadLabels, tierOf, dayParts } from '../tools/share_pics.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const looks = JSON.parse(readFileSync(join(ROOT, 'tools/og_looks.json'), 'utf8')); loadLooks(looks);
let pass = 0, fail = 0; const bad = [];
const ok = (c, m) => { if (c) pass++; else { fail++; if (bad.length < 25) bad.push(m); } };

// ---- the building blocks ----
ok(titleCase('FDA proof required to sell e-cigarettes') === 'FDA Proof Required to Sell E-Cigarettes', 'title case: FDA, hyphen, small words');
ok(titleCase('a vote on the Hawaiʻi plan') === 'A Vote on the Hawaiʻi Plan', 'title case keeps ʻokina and small words');
ok(tierOf(9) === 0 && tierOf(10) === 10 && tierOf(212) === 200 && tierOf(5000) === 5000, 'a count shows only from 10, in tiers');
ok(dayParts('2026-03-17').day === '17' && dayParts('2026-03-17').dow === 'Tuesday' && dayParts('2026-03-17').month === 'March', 'a deadline day in Hawaiʻi time');
ok(dayParts('2026-03-18T11:00:00.000Z').short === dayWords('2026-03-18T11:00:00.000Z'), 'a timestamp reads like the card');
const names = ARMS.map(a => ARM_NAMES[a]); ok(new Set(names).size === ARMS.length && names.every(Boolean), 'every version has its own name');

// ---- every bill, every stage ----
const snap = JSON.parse(readFileSync(join(ROOT, 'demo/snapshot.json'), 'utf8')), D = demoSets(snap);
const words = wordsMap(existsSync(join(ROOT, 'demo/share_words.json')) ? JSON.parse(readFileSync(join(ROOT, 'demo/share_words.json'), 'utf8')) : [], { onlyChecked: false });
const issueById = new Map(D.issues.map(i => [i.id, i]));
const STAGES = [null, 'first_floor', 'second_floor', 'conference', 'governor', 'enacted', 'dead'];
const dateRe = /\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun), (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}\b/g;
const textOf = s => Object.values(s).flatMap(v => Array.isArray(v) ? v.flatMap(x => typeof x === 'object' ? Object.values(x) : x) : typeof v === 'object' ? [] : v).filter(v => typeof v === 'string');
const counts = Object.fromEntries(ARMS.map(a => [a, 0])), seen = new Map(), real = new Map(); let pages = 0;
for (const base of D.bills) {
  for (const stage of STAGES) {
    const b = stage ? { ...base, stage, last_action: '' } : base;
    const state = billState(b, { hearings: D.hearingsBy.get(b.id) || [], outcomes: D.outcomes, deadlineFor: D.deadlineFor(b), now: D.now });
    const issue = (b.hiphi_issues || []).map(id => issueById.get(id)).find(Boolean) || null, ctx = { committees: D.committees, issue };
    for (const ask of asksFor(b, state)) {
      const card = cardFor(b, ask, state, ctx); pages++;
      const specs = specsFor({ b, ask, state, card, ctx, words: issue ? words.get(issue.id) : null, counts: { testimonies: 212, emails: 87, followers: 140 }, practice: true });
      const where = `${b.bill_number}${stage ? `@${stage}` : ''}-${ask}`, side = state.side, st = state.st;
      for (const [arm, sp] of Object.entries(specs)) {
        counts[arm]++; const key = picPath(sp); seen.set(key, sp); if (!stage) real.set(key, sp);
        const all = textOf(sp).join(' | ');
        ok(sp.v === arm && sp.look === card.image, `${where} ${arm}: its own version and the card's look`);
        ok(!/undefined|null|NaN|\[object/.test(all), `${where} ${arm}: no stray word (${all.slice(0, 80)})`);
        ok(!/\bvap(e|es|ing)\b/i.test(all) && !/neighbour/i.test(all) && !/[—–]/.test(all), `${where} ${arm}: the word rules`);
        // The ask's own direction: a bill HIPHI opposes never says yes, sign or pass, and one it supports never says no, veto or stop.
        if (side === 'oppose' && arm !== 'stand' && arm !== 'letter') ok(!/vote yes|to sign it|Lawmakers to Pass|I support|Help This Bill Get a Hearing|Please sign|Please vote yes|Please pass|give .* a hearing|Speak(ing)? up for|spoke up for/i.test(all.replace(/not to pass|do not pass/gi, '')), `${where} ${arm}: says yes on a bill HIPHI opposes (${all.slice(0, 120)})`);
        if (side === 'support' && arm !== 'stand' && arm !== 'letter') ok(!/vote no|veto|not to pass|do not pass|not to hear|I oppose|Say No to|speak(s)? up against/i.test(all), `${where} ${arm}: says no on a bill HIPHI supports (${all.slice(0, 120)})`);
        // Facts, each from the reading the card's title uses.
        const h = state.open, due = h && h.testimony_deadline && new Date(h.testimony_deadline).getTime() > D.now ? h.testimony_deadline : null;
        if (arm === 'calendar') {
          const date = ask === 'testify' ? due : st.deadline?.date, p = date ? dayParts(date) : null;
          ok(!!p && sp.day === p.day && sp.month === p.month && sp.dow === p.dow, `${where} calendar: the date is the ask's own`);
          if (ask === 'testify') ok(card.title.includes(dayWords(due)), `${where} calendar: the card's title says the same day`);
          ok(['testify', 'ask', 'floor', 'conference'].includes(ask) && (ask === 'testify' || !st.deadline?.missed), `${where} calendar: only where a date is set and not past`);
        }
        if (arm === 'ticket') ok(ask === 'testify' && !!h && sp.line1.includes(dayWords(h.scheduled_at)) && sp.line1.toLowerCase().includes(committeeWords(h.committee, D.committees).replace(/^the /, '').toLowerCase()), `${where} ticket: the hearing's own day and committee`);
        if (arm === 'here') {
          const node = roadNode(b, st), i = sp.steps.findIndex(x => x.at === 'here');
          ok(node != null && (node === 6 ? i === -1 && sp.steps.every(x => x.at === 'done') : i === node && sp.steps.slice(0, node).every(x => x.at === 'done') && sp.steps.slice(node + 1).every(x => x.at === 'todo')), `${where} here: the marker is on the bill's own step (${node})`);
          ok(!['dead', 'vetoed', 'ballot'].includes(st.phase), `${where} here: never for a bill that stopped`);
          ok(sp.steps.map(x => x.label).join() === roadLabels(b).map((l, j) => sp.steps[j].label === 'Committee Hearing' ? 'Committee Hearing' : l).join(), `${where} here: the road's chambers follow the bill's own`);
        }
        if (arm === 'letter') {
          ok(side === 'support' || side === 'oppose', `${where} letter: only with a side`);
          const code = String((ask === 'testify' ? h?.committee : st.committee) || '');
          if ((ask === 'testify' || ask === 'ask') && code && !code.includes('/')) { const chair = D.committees[code]?.chair; ok(chair ? sp.greet === `Aloha Chair ${chair},` : sp.greet === 'Aloha Chair,', `${where} letter: the committee's own chair (${sp.greet} / ${chair})`); }
          if (ask === 'floor') ok(sp.greet === `Aloha ${st.chamber === 'S' ? 'Senator' : 'Representative'},`, `${where} letter: the chamber's own member`);
          ok(!/Leilani|Kalihi/.test(sp.body), `${where} letter: no made-up person`);
          // The first sentence says the bill's own side (the talking points after it are HIPHI's own words).
          const lead = sp.body.split(/(?<=[.!?])\s/)[0];
          ok(side === 'oppose' ? /oppose|do not|no on|veto/i.test(lead) : /support|Please (give|vote yes|pass|sign)/i.test(lead) && !/oppose|do not|veto/i.test(lead), `${where} letter: the first line takes the bill's side (${lead})`);
        }
        if (arm === 'sign' || arm === 'before') ok(issue?.stance === (side === 'oppose' ? 'oppose' : 'support') && !!words.get(issue.id), `${where} ${arm}: written in the issue's own direction`);
        if (arm === 'before') ok(!['dead', 'vetoed', 'law', 'ballot'].includes(st.phase), `${where} before: "If it passes" only while alive`);
        if (arm === 'crowd') ok(/^\d[\d,]*\+$/.test(sp.n) && +sp.n.replace(/\D/g, '') >= 10, `${where} crowd: never a count under 10 (${sp.n})`);
        if (arm === 'stand') ok(ask === 'follow' && st.phase !== 'law', `${where} stand: only for following`);
        if (['calendar', 'sign', 'letter', 'text', 'neighbors', 'islands', 'before', 'here', 'ticket', 'crowd', 'stand', 'postcard'].includes(arm) && ask !== 'follow') ok(state.ask === ask, `${where} ${arm}: only for the bill's own ask of the moment`);
        // The headline words are in title case.
        for (const k of ['head', 'name', 'big']) if (typeof sp[k] === 'string' && arm !== 'stand' && arm !== 'letter') ok(sp[k] === titleCase(sp[k]) || /^(Where|Last|Can You|Every|Speak|Aloha|Your|The Final)/.test(sp[k]) || sp[k] === titleCase(sp[k]).replace(/ \b(To|On|Of|For)\b/g, m => m.toLowerCase()), `${where} ${arm}: ${k} in title case (${sp[k]})`);
        // Dates written on a picture are dates the card knows (a deadline, a hearing), never another.
        const known = new Set([due, h?.scheduled_at, st.deadline?.date].filter(Boolean).map(d => dayParts(d).short));
        for (const m of all.match(dateRe) || []) ok(known.has(m), `${where} ${arm}: the date "${m}" is the bill's own`);
      }
      // Every share page keeps today's picture whatever the versions do: a version is an addition.
      ok(!specs.today, `${where}: today's picture is not a spec`);
    }
  }
}
// The same words, the same picture: one file for everything that says the same.
ok(seen.size < pages * 2, `pictures are shared where words are: ${seen.size} for ${pages} pages`);
for (const a of ARMS.filter(a => a !== 'today')) ok(counts[a] > 0 || a === 'crowd', `${a}: fits somewhere (${counts[a]})`);
// The key changes with any word and with the template version.
const sample = [...seen.values()][0]; ok(specKey(sample) === specKey({ ...sample }) && specKey(sample) !== specKey({ ...sample, extra: 1 }), 'a spec’s file name follows its words');
// Title case here and in the drawing code agree on every issue name.
const py = execFileSync('python3', ['-c', `import json,sys;sys.argv=['x'];sys.path.insert(0,'tools');import og_images as o;print(json.dumps([o.title(n) for n in json.load(sys.stdin)]))`], { cwd: ROOT, input: JSON.stringify(D.issues.map(i => i.name)) }).toString();
ok(JSON.stringify(JSON.parse(py)) === JSON.stringify(D.issues.map(i => titleCase(i.name))), 'title case in JavaScript and in the drawing code agree on all 91 issue names');

// ---- the pages the builder writes ----
const { picBuilder } = await import('../tools/share_pic_pages.mjs');
const tmp = mkdtempSync(join(tmpdir(), 'pics-')); mkdirSync(join(tmp, 'pub/og/t/letter'), { recursive: true }); mkdirSync(join(tmp, 'tools'), { recursive: true });
writeFileSync(join(tmp, 'tools/og_looks.json'), readFileSync(join(ROOT, 'tools/og_looks.json')));
{
  const b = D.bills.find(x => x.bill_number === 'HB1573'), state = billState(b, { hearings: D.hearingsBy.get(b.id) || [], outcomes: D.outcomes, deadlineFor: D.deadlineFor(b), now: D.now });
  const issue = (b.hiphi_issues || []).map(id => issueById.get(id)).find(Boolean), ctx = { committees: D.committees, issue }, card = cardFor(b, 'testify', state, ctx);
  const inp = { b, ask: 'testify', state, card, ctx, words: words.get(issue.id), counts: null };
  const specs = specsFor(inp), want = new Map(), page = p => `<page ${p.image} ${p.to} ${p.noindex}>`;
  let pb = picBuilder({ ROOT: tmp, want, page });
  const to = f => `${'../'.repeat(f)}track.html?via=share#/bill/2026/HB1573/testify`;
  ok(pb.add('b/2026/HB1573-testify', card, to, inp, new Set(['letter', 'issue'])).length === 0 && pb.wantedPics.size === 2, 'a version with no picture drawn yet has no page, and its picture is wanted');
  writeFileSync(join(tmp, 'pub', picPath(specs.letter)), 'x');
  pb = picBuilder({ ROOT: tmp, want, page });
  const got = pb.add('b/2026/HB1573-testify', card, to, inp, new Set(['letter', 'issue']));
  const pg = want.get('p/letter/b/2026/HB1573-testify.html');
  ok(got.join() === 'letter' && !!pg, 'a drawn version has its page at p/<version>/<the same path>, and only that one');
  ok(pg.includes(picPath(specs.letter)) && pg.includes('../../../../track.html?via=share&pic=letter#/bill/2026/HB1573/testify'), `its page shows its picture and opens the tracker four folders up with &pic=letter (${pg})`);
  ok(pb.fit['b/2026/HB1573-testify'] === 'letter', 'the manifest names the versions that have a page');
  ok(pb.add('b/demo/HB1573-testify', card, f => `${'../'.repeat(f)}track.html?demo=1&via=share#/bill/2026/HB1573/testify`, inp, new Set()).length === 0, 'a version that is off gets no page');
}
rmSync(tmp, { recursive: true, force: true });

// DUMP=file: the distinct pictures of the bills as they stand, for tests/share_pics_draw.py (every one drawn, none may run long).
if (process.env.DUMP) writeFileSync(process.env.DUMP, JSON.stringify([...real].map(([file, spec]) => ({ file, spec }))));
console.log(`${pass} passed, ${fail} failed; ${pages} share pages, ${seen.size} distinct pictures; fits: ${ARMS.filter(a => a !== 'today').map(a => `${a} ${counts[a]}`).join(', ')}`);
if (bad.length) console.log('\n' + bad.join('\n'));
process.exit(fail ? 1 : 0);
