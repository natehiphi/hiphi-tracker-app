// The quick checks: the Tests steps that need no browser and take seconds (about 8 together). One list, run in two places
// (R-278, Nate's go 15 Oct): before every push from this machine (the pre-push hook in backend/.githooks), so a stale words
// list or a syntax slip is refused with its reason before it reaches main, and as the first step of Tests on GitHub.
// Every check runs even when one fails, so one run names every stale check at once instead of one per push.
//   node tools/quick_checks.mjs
import { spawnSync, execSync } from 'child_process';
import fs from 'fs';

const root = new URL('..', import.meta.url).pathname;
const run = (cmd, args, input) => spawnSync(cmd, args, { cwd: root, encoding: 'utf8', input });

// The pre-push hook runs this on a plain copy of the commit being pushed (git archive, no .git), so it lists the files itself there.
function jsFiles() {
  try { return execSync("git ls-files '*.js' '*.mjs'", { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).split('\n').filter(Boolean); }
  catch { return fs.readdirSync(root, { recursive: true }).filter(f => /\.m?js$/.test(f) && !f.split('/').includes('node_modules')); }
}
// The syntax of every JS file, module-aware (the public page and Staff v2 load as modules).
function syntax() {
  const files = jsFiles();
  const bad = files.filter(f => run('node', ['--input-type=module', '--check'], fs.readFileSync(root + f, 'utf8')).status !== 0);
  return { ok: !bad.length, out: bad.map(f => 'SYNTAX ERROR in ' + f).join('\n') };
}

const CHECKS = [
  ['Syntax of every JS file (module-aware)', syntax],
  ['The two staff apps make the same data calls', 'staff/tools/parity.mjs'],
  ["The public page's first load carries the kernel only (R-122)", 'tools/check_split.mjs'],
  ["The suggested bill's rules", 'tests/rank_test.mjs'],
  ['HIPHI\'s words ("e-cigarettes", never "vapes", R-158)', 'tests/words_test.mjs'],
  ['The share cards lead with the ask and open it (R-169)', 'tests/share_cards_test.mjs'],
  ['What kind of advocate are you? Its words and its scoring (R-217, a draft)', 'tests/quiz_test.mjs'],
  ['The words list for the checker panel is current (R-166 step 3)', 'tools/words_extract.mjs', '--check'],
];

const failed = [];
for (const [name, what, ...args] of CHECKS) {
  const r = typeof what === 'function' ? what() : (s => ({ ok: s.status === 0, out: (s.stdout + s.stderr).trim() }))(run('node', [what, ...args]));
  console.log((r.ok ? 'ok   ' : 'FAIL ') + name);
  if (!r.ok) { failed.push(name); if (r.out) console.log(r.out.split('\n').slice(-15).map(l => '     ' + l).join('\n')); }
}
if (failed.length) {
  console.log(`\n${failed.length} of ${CHECKS.length} quick checks failed. If a screen's words changed on purpose, the check's own message says which file`
    + ' records them: update it in the same commit.');
  process.exit(1);
}
console.log(`\nall ${CHECKS.length} quick checks passed`);
