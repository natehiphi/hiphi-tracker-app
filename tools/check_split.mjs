// The public page's first load (R-122): the kernel and the modules on the first wave must not pull the bill-level code.
//   node tools/check_split.mjs        exits 1 with the reasons when the split is broken. Run by .github/workflows/tests.yml.
import fs from 'node:fs';
import path from 'node:path';
const read = f => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const imports = f => [...read(f).matchAll(/^import\s[^;]*?from\s+'([^']+)'/gm)].map(m => m[1]);
const bad = [];
// 1. the kernel imports nothing bill-level
for (const dep of imports('pub/kernel.js')) if (/core\.js|stops\.js|rank\.js|demo\.js/.test(dep)) bad.push(`pub/kernel.js imports ${dep}`);
// 2. the first wave imports only the kernel (and each other), never core.js: a static import there would bring it back
for (const f of ['pub/app.js', 'pub/ui.js', 'pub/fx.js', 'pub/keep.js', 'pub/visitlog.js', 'pub/variant.js', 'pub/errlog.js', 'pub/topics.js', 'pub/start.js'])
  for (const dep of imports(f)) if (/\/core\.js$|stops\.js|demo\.js|lessons\.js|bill\.js|home\.js|actions\.js|start-rest\.js/.test(dep)) bad.push(`${f} imports ${dep} on the first wave`);   // rank.js (4 KB) may ride along: the topics tiles score with it
// 3. the kernel's copy of HELD_RE equals stops.js's
const re = f => (/^export const HELD_RE = (.*)$/m.exec(read(f)) || [])[1];
if (re('pub/kernel.js') !== re('stops.js')) bad.push('HELD_RE differs between pub/kernel.js and stops.js');
// 4. track.html preloads the kernel for everyone and core.js only from its inline script (for the browsers that need it first)
const html = read('track.html');
if (!/<link rel="modulepreload" href="pub\/kernel\.js">/.test(html)) bad.push('track.html does not preload pub/kernel.js');
if (/<link rel="modulepreload" href="pub\/(core|demo)\.js">|<link rel="modulepreload" href="stops\.js">/.test(html)) bad.push('track.html preloads the bill-level code for everyone');
// 5. every module the first wave and the first screens import is named in track.html (R-357 5a). A module's own imports are
//    known to the browser only once it has arrived and been read, so a nested one the page does not name costs a round trip
//    on its own (400 ms on a slow phone; i18n.js -> words/live.js, plans.js -> langpick.js were three such hops). The head's
//    modulepreload lines and the inline script's lists (a first visit's start.js, a returner's calm/home.js, a bill link's
//    bill.js) must between them name the whole static import tree of each. Add the name where the message says.
const staticDeps = f => [...read(f).matchAll(/^(?:import|export)\s[^;]*?from\s+'([^']+)'|^import\s+'([^']+)'/gm)].map(m => m[1] || m[2]).filter(d => d.startsWith('.'));   // import ... from, export ... from, import '...'
const tree = entry => {
  const seen = new Set(), todo = [entry];
  while (todo.length) {
    const f = todo.pop(); if (seen.has(f)) continue; seen.add(f);
    for (const d of staticDeps(f)) todo.push(path.posix.normalize(path.posix.join(path.posix.dirname(f), d)));
  }
  return [...seen];
};
const named = f => html.includes(`href="${f}"`) || html.includes(`'${f}'`);
const unnamed = new Map();
for (const [what, entry] of [['the first wave', 'pub/app.js'], ['a first visit', 'pub/start.js'], ['a returner\u2019s Home', 'pub/calm/home.js'], ['a bill link', 'pub/bill.js']])
  for (const f of tree(entry)) if (!named(f)) unnamed.set(f, [...(unnamed.get(f) || []), what]);
for (const [f, whats] of unnamed) bad.push(`track.html does not name ${f}, which ${whats.join(' and ')} import${whats.length > 1 ? '' : 's'}: add it to the modulepreload lines or the inline script's lists`);
if (bad.length) { console.error('the first load is not what it should be:\n  ' + bad.join('\n  ')); process.exit(1); }
console.log('split ok: the first wave carries the kernel only');
