// The public page's first load (R-122): the kernel and the modules on the first wave must not pull the bill-level code.
//   node tools/check_split.mjs        exits 1 with the reasons when the split is broken. Run by .github/workflows/tests.yml.
import fs from 'node:fs';
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
if (bad.length) { console.error('the first load is not what it should be:\n  ' + bad.join('\n  ')); process.exit(1); }
console.log('split ok: the first wave carries the kernel only');
