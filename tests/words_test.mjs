// HIPHI's own words, checked on every push (docs/DESIGN.md C-10; runs in the public repo's tests.yml, no server needed).
//   1-2. "e-cigarettes", never "vape", "vapes" or "vaping" (R-158), in the sandbox data (a copy of production's, so a rebuilt
//        snapshot brings staff's latest wording) and the quoted text in the apps' code. The Legislature's own titles and
//        descriptions are theirs and are not checked; the search's synonyms, the topic matcher and the old issue addresses
//        name the word on purpose and are allowed below.
//   3.   Reading grade (X4-3, R-180): the Flesch-Kincaid grade of every bill summary, talking point, issue description and
//        outlook in the sandbox data, by the same formula as tests/checks.py fk_grade. C-10 asks grade 8 or below. Most
//        summaries are over it today and are to be rewritten (X4-2), so this prints how many are over 8 and fails only when
//        a count RISES above its baseline below: new words over grade 8 turn the push red; old ones are reported.
//   4.   "Hawaiʻi" with its ʻokina (U+02BB) in the public page's own words (pub/): never "Hawaii", "Hawai'i" or "Hawai‘i".
//        The Legislature's bill titles come from the data, not the code, and keep their own spelling.
//   5.   Never "dead" or "died" in words the public page shows (pub/): a bill "stopped" or "did not advance". The stage
//        code 'dead' and class names like lx-dead are code, not words, and are not counted.
//   6.   The share pictures' words (R-183): what tools/share_pics.mjs and og_looks.json write on a picture, and the drafts of the
//        issues' own words (demo/share_words.json): "e-cigarettes", never "vape"; "Hawaiʻi" with its ʻokina; American spelling
//        ("neighbors"); never "dead" or "died"; no em or en dash.
//   node tests/words_test.mjs
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

// 2b. The word list (C-15, X4-6): retired words in the quoted text of the code (comments skipped). American spelling is checked here;
// the other rows are found by the screen tests and by eye ("log in" appears for the Capitol website's own login, which is its word). The
// classic staff app (app.js) is look-only and keeps what it has.
const RETIRED = [[/\b(neighbour|favour|recognise|organise|colour)(s|ed|ing|ful)?\b(?!\s*\()/i, 'American spelling (neighbor, favor, recognize, organize)']];
const retired = [];
for (const f of files.filter(f => f !== 'app.js')) {
  let src; try { src = readFileSync(join(ROOT, f), 'utf8'); } catch { continue; }
  src.split('\n').forEach((line, n) => {
    const text = line.replace(/^\s*\/\/.*$/, '').replace(/\s\/\/\s.*$/, '').replace(/^\s*\*.*$/, '');
    for (const [re, why] of RETIRED) if (re.test(text) && !/(http|\/\*|class=|id=)/.test(text.match(re)?.[0] || '')) retired.push(`${f}:${n + 1}: ${why}: ${line.trim().slice(0, 100)}`);
  });
}
check(!retired.length, `no retired word in the apps' quoted text (docs/DESIGN.md C-15)${retired.length ? `:\n  ${retired.join('\n  ')}` : ''}`);

// 3. Reading grade of the content (X4-3). The same arithmetic as tests/checks.py: sentences of three words or more, a word
// is anything with a letter in it, and syllables are counted by vowel groups.
const syllables = word => {
  let w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 0;
  if (w.length <= 3) return 1;
  w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '');
  return Math.max(1, (w.match(/[aeiouy]{1,2}/g) || []).length);
};
const fkGrade = text => {
  const sents = String(text).split(/[.!?]+\s|\n+/).filter(t => t.split(/\s+/).filter(Boolean).length >= 3);
  const words = sents.flatMap(t => t.split(/\s+/).filter(Boolean)).filter(w => /[A-Za-z]/.test(w));
  if (!sents.length || !words.length) return 0;
  const syl = words.reduce((n, w) => n + syllables(w), 0);
  return Math.round((0.39 * (words.length / sents.length) + 11.8 * (syl / words.length) - 15.59) * 10) / 10;
};
// How many were over grade 8 when this check was written (5 Oct 2026, the snapshot of 21 Sep: 734 summaries, 744 talking
// points, 91 issue descriptions, 91 outlooks). Lower a number when rewrites bring it down (the run says when); raise one
// only with a reason in the commit, for example a new session's bills added to the snapshot.
const OVER8 = { summaries: 654, talking_points: 464, issue_descriptions: 35, outlooks: 3 };
const kinds = {
  summaries: (snap.bills || []).map(b => [b.bill_number, b.public_summary]),
  talking_points: (snap.bills || []).flatMap(b => (b.talking_points || []).map((t, k) => [`${b.bill_number} #${k + 1}`, t])),
  issue_descriptions: (snap.issues || []).map(i => [i.slug, i.description]),
  outlooks: (snap.issues || []).map(i => [i.slug, i.outlook]),
};
for (const [kind, rows] of Object.entries(kinds)) {
  const texts = rows.filter(([, t]) => typeof t === 'string' && t.trim());
  const over = texts.map(([w, t]) => [w, fkGrade(t), t]).filter(([, g]) => g > 8).sort((a, b) => b[1] - a[1]);
  const base = OVER8[kind], name = kind.replace(/_/g, ' ');
  check(over.length <= base, `${name}: ${over.length} of ${texts.length} read above grade 8 (baseline ${base}${over.length < base ? `; lower OVER8.${kind} to ${over.length}` : ''})`
    + (over.length > base ? `. Hardest: ${over.slice(0, 3).map(([w, g]) => `${w} ${g}`).join(', ')}. Rewrite new words to grade 8 (C-10)` : ''));
}

// The quoted text of a script, without its comments, regular expressions or the code inside a template's ${...}: the
// words a screen can show, each with its line. Enough of a reader for this repo's plain modules.
function quoted(src) {
  const out = [], tpl = [], n = src.length;
  let i = 0, line = 1, depth = 0, last = '', word = '';
  const template = () => {   // from just after a backtick, or the } that closes a ${...}, to the next backtick or ${
    let s = '', at = line;
    while (i < n) {
      const c = src[i];
      if (c === '\\') { s += src[i + 1] || ''; if (src[i + 1] === '\n') line++; i += 2; continue; }
      if (c === '`') { i++; out.push([s, at]); last = 'a'; word = ''; return; }
      if (c === '$' && src[i + 1] === '{') { i += 2; out.push([s, at]); tpl.push(depth++); last = '{'; word = ''; return; }
      if (c === '\n') line++;
      s += c; i++;
    }
  };
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === '\n') { line++; i++; continue; }
    if (c === ' ' || c === '\t' || c === '\r') { i++; continue; }
    if (c === '/' && d === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && d === '*') { const e = src.indexOf('*/', i + 2), end = e < 0 ? n : e + 2; line += (src.slice(i, end).match(/\n/g) || []).length; i = end; continue; }
    if (c === '"' || c === "'") {
      let s = ''; const at = line; i++;
      while (i < n && src[i] !== c && src[i] !== '\n') { if (src[i] === '\\') { s += src[i + 1] || ''; i += 2; } else s += src[i++]; }
      i++; out.push([s, at]); last = 'a'; word = ''; continue;
    }
    if (c === '`') { i++; template(); continue; }
    if (c === '/') {
      // A regular expression wherever a value is expected (after an operator, a bracket, a comma or a keyword); else division.
      if (!last || /[(,=:[!&|?{};+\-*%<>~^]/.test(last) || /^(return|typeof|case|in|of|void|delete|new|throw|else|do|yield|await)$/.test(word)) {
        let cls = false; i++;
        while (i < n && src[i] !== '\n') { const ch = src[i]; if (ch === '\\') { i += 2; continue; } if (ch === '[') cls = true; else if (ch === ']') cls = false; else if (ch === '/' && !cls) break; i++; }
        i++; while (i < n && /[a-z]/i.test(src[i])) i++;
        last = 'a'; word = ''; continue;
      }
      last = '/'; word = ''; i++; continue;
    }
    if (c === '{') { depth++; last = c; word = ''; i++; continue; }
    if (c === '}') { if (tpl.length && tpl[tpl.length - 1] === depth - 1) { tpl.pop(); depth--; i++; template(); continue; } depth--; last = c; word = ''; i++; continue; }
    if (/[\w$]/.test(c)) { let w = ''; while (i < n && /[\w$]/.test(src[i])) w += src[i++]; last = 'a'; word = w; continue; }
    last = c; word = ''; i++;
  }
  return out;
}
const pubFiles = ['pub', 'pub/a'].flatMap(d => readdirSync(join(ROOT, d)).filter(f => /\.js$/.test(f)).map(f => `${d}/${f}`));
const pubWords = pubFiles.flatMap(f => quoted(readFileSync(join(ROOT, f), 'utf8')).map(([text, line]) => ({ f, line, text })));
const show = list => list.length ? `:\n  ${list.map(x => `${x.f}:${x.line}: ${x.text.trim().slice(0, 110)}`).join('\n  ')}` : '';

// 4. Hawaiʻi with its ʻokina in the public page's own words.
const HAWAII = /\bHawai(?:i|['‘’`]i)\b/;
// A map search sent to Google (actions.js, the Capitol's directions): Google's own name for the place, never shown.
const HAWAII_OK = [/^Hawaii State Capitol, 415 S Beretania St/];
const noOkina = pubWords.filter(x => HAWAII.test(x.text) && !HAWAII_OK.some(a => a.test(x.text)));
check(pubWords.length > 1000 && !noOkina.length, `the public page writes "Hawaiʻi" with its ʻokina (${pubWords.length} quoted strings read in pub/)${show(noOkina)}`);

// 5. Never "dead" or "died" on the public page. Only words count: a string with a space in it, the word on its own (not a
// code like 'dead', a class like lx-dead, or a key like f.dead).
const DEAD = /(?<![-\w.])(dead|died)(?![-\w])/i;
const dead = pubWords.filter(x => /\s/.test(x.text.trim()) && DEAD.test(x.text));
check(!dead.length, `the public page never says a bill is "dead" or "died"${show(dead)}`);

// 5b. A bill that is out for the year "did not advance" (Nate 10/7, R-144): the public page never calls it "stopped" or says it
// "stops for the year" (the label and every reason now say what happened, and that it can't pass this year). Following and
// sharing can still "stop" (Stop following, Stop sharing); a text stop is its own word; the STOP reply to a text is not a status.
const STOPWORD = /\b(stopped (this|here|in|before|at|for)\b|stops (for|this|it)\b|usually stops\b|bills? stop\b|(it|they|bill) stopped\b)/i;
const stoppedWords = pubWords.filter(x => /\s/.test(x.text.trim()) && STOPWORD.test(x.text) && !/follow|shar|text|reply stop|number|unsubscribe|email/i.test(x.text));
check(!stoppedWords.length, `the public page says "did not advance", never "stopped" or "stops for the year"${show(stoppedWords)}`);

// 6. The share pictures' words (R-183).
{
  const looks = JSON.parse(readFileSync(join(ROOT, 'tools/og_looks.json'), 'utf8'));
  const own = [...quoted(readFileSync(join(ROOT, 'tools/share_pics.mjs'), 'utf8')).map(([text, line]) => ({ f: 'tools/share_pics.mjs', line, text })),
    ...Object.entries(looks).filter(([k]) => !k.startsWith('_')).flatMap(([k, v]) => ['label', 'big', 'sub', 'short', 'foot'].map(f => ({ f: `tools/og_looks.json ${k}`, line: 0, text: v[f] }))),
    ...JSON.parse(readFileSync(join(ROOT, 'demo/share_words.json'), 'utf8')).flatMap(r => [r.slogan, r.before_text, r.after_text].filter(Boolean).map(text => ({ f: 'demo/share_words.json', line: 0, text })))]
    .filter(x => /[a-z]/i.test(x.text) && /\s/.test(x.text.trim()));
  const bad6 = own.filter(x => WORD.test(x.text) || (HAWAII.test(x.text)) || /neighbour/i.test(x.text) || (DEAD.test(x.text)) || /[—–]/.test(x.text));
  check(own.length > 100 && !bad6.length, `the share pictures' words follow the word rules (${own.length} strings read)${show(bad6)}`);
}

console.log(`\n${ok} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
