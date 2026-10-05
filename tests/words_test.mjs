// HIPHI's own terms (docs/DESIGN.md C-10, R-158): "e-cigarettes", never "vape", "vapes" or "vaping". Checks HIPHI's words
// in the sandbox data (a copy of production's, so a rebuilt snapshot brings staff's latest wording) and the quoted text in
// the apps' code. The Legislature's own titles and descriptions are theirs and are not checked; the search's synonyms,
// the topic matcher and the old issue addresses name the word on purpose and are allowed below.
//   node tests/words_test.mjs   (no server needed)
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const WORD = /\bvap(e|es|ed|er|ers|ing)\b/i;
let ok = 0, fail = 0;
const check = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); c ? ok++ : fail++; };

// 1. HIPHI's words in the sandbox data.
const snap = JSON.parse(readFileSync(join(ROOT, 'demo/snapshot.json'), 'utf8'));
const hits = [];
const look = (where, v) => { for (const t of [].concat(v ?? [])) if (typeof t === 'string' && WORD.test(t)) hits.push(`${where}: ${t}`); };
for (const b of snap.bills || []) for (const k of ['nickname', 'public_summary', 'public_action', 'talking_points']) look(`${b.bill_number} ${k}`, b[k]);
for (const i of snap.issues || []) for (const k of ['slug', 'name', 'description', 'outlook']) look(`issue ${i.slug} ${k}`, i[k]);
for (const c of snap.categories || []) for (const k of ['name', 'description']) look(`category ${c.key} ${k}`, c[k]);
for (const l of snap.lists || []) for (const k of ['title', 'description']) look(`list ${l.slug} ${k}`, l[k]);
for (const c of snap.campaigns || []) for (const k of ['public_name', 'description']) look(`coalition ${c.name} ${k}`, c[k]);
for (const d of [...(snap.drafts || []), ...JSON.parse(readFileSync(join(ROOT, 'demo/drafts.json'), 'utf8'))]) look(`draft note ${d.version}`, d.summary);
check(!hits.length, `the sandbox's names, summaries, talking points, lists and draft notes say "e-cigarettes"${hits.length ? `:\n  ${hits.join('\n  ')}` : ''}`);

// 2. Quoted text in the apps' code (comments are skipped: they may explain the synonym).
const ALLOWED = [/FORMER_SLUGS = /, /^\s*\['vape', 'vaping'/, /re: \/tobacco\|vape\|/];
const files = ['app.js', 'index.html', 'track.html', 'staff.html', 'compare.html',
  ...['pub', 'pub/a', 'staff'].flatMap(d => readdirSync(join(ROOT, d)).filter(f => /\.(js|html)$/.test(f)).map(f => `${d}/${f}`))];
const code = [];
for (const f of files) {
  let src; try { src = readFileSync(join(ROOT, f), 'utf8'); } catch { continue; }
  src.split('\n').forEach((line, n) => {
    const text = line.replace(/^\s*\/\/.*$/, '').replace(/\s\/\/\s.*$/, '');
    if (WORD.test(text) && !ALLOWED.some(a => a.test(line))) code.push(`${f}:${n + 1}: ${line.trim().slice(0, 120)}`);
  });
}
check(!code.length, `no screen or hint in the code says "vape"${code.length ? `:\n  ${code.join('\n  ')}` : ''}`);

console.log(`\n${ok} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
