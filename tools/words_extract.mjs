// Lists the English words the public page says through t(), tn() and T() (R-166 step 3), for the checker panel (backend
// tools/translate.js) and for the test that every live language has them all. Writes pub/words/en.json:
//   { "words": [ "About 4 minutes. Free.", "{n} issue", ... ], "files": { "pub/start.js": 31, ... } }
// A word is the English string itself (the first argument, a plain literal; {name} marks a value put in later). tn(n, 'issue')
// gives the two words '{n} issue' and '{n} issues'. A call whose first argument is not a literal is not listed: use T('...')
// where the literal is written and t(variable) where it is drawn. Run: node tools/words_extract.mjs [--check]
//   --check  fails when pub/words/en.json is not what the code now says (so a new word is never forgotten).
import fs from 'fs';
const dir = new URL('../pub/', import.meta.url).pathname;
const files = fs.readdirSync(dir).filter(f => f.endsWith('.js') && !['i18n.js'].includes(f)).sort();
const lit = "(?:'((?:\\\\.|[^'\\\\])*)'|\"((?:\\\\.|[^\"\\\\])*)\"|`((?:\\\\.|[^`\\\\$]|\\$(?!\\{))*)`)";
const reT = new RegExp("(?<![\\w.$])(?:t|T)\\(\\s*" + lit, 'g');
const reTn = new RegExp("(?<![\\w.$])tn\\(\\s*[^,()]+(?:\\([^()]*\\))?[^,()]*,\\s*" + lit + "(?:\\s*,\\s*" + lit + ")?", 'g');
const unq = s => s.replace(/\\(['"`\\])/g, '$1').replace(/\\n/g, '\n');
const words = new Set(), per = {};
for (const f of files) {
  const src = fs.readFileSync(dir + f, 'utf8'); let n = 0;
  for (const m of src.matchAll(reT)) { words.add(unq(m[1] ?? m[2] ?? m[3])); n++; }
  for (const m of src.matchAll(reTn)) { const one = unq(m[1] ?? m[2] ?? m[3]); const many = m[4] ?? m[5] ?? m[6]; words.add('{n} ' + one); words.add('{n} ' + (many !== undefined ? unq(many) : one + 's')); n++; }
  if (n) per['pub/' + f] = n;
}
const out = JSON.stringify({ words: [...words].sort((a, b) => a.localeCompare(b)), files: per }, null, 1) + '\n';
const path = dir + 'words/en.json';
if (process.argv.includes('--check')) {
  const have = fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : '';
  if (have !== out) { console.error('pub/words/en.json is out of date: run node tools/words_extract.mjs'); process.exit(1); }
  console.log(`words ok: ${words.size} words in ${Object.keys(per).length} files`);
} else { fs.writeFileSync(path, out); console.log(`${words.size} words in ${Object.keys(per).length} files -> pub/words/en.json`); }
