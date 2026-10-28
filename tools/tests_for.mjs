// Which browser tests a build runs: only the ones for the files it changed (R-351, Nate's go 27 Oct 2026).
//
// Why: builds ran the same long tests over and over whatever they changed. Between 13 and 27 Oct density.py (3.5 min) and
// public_journey.py ran about 400 times each, and browser tests took 10 to 18 minutes of every build. The full set still
// runs on every push in Tests (.github/workflows/tests.yml, eight machines, about 10 minutes), and the next build's first
// step owns a red run (R-345), so a build only needs the tests that cover what it touched.
//
//   node tools/tests_for.mjs                 the files this branch changed against origin/main, plus uncommitted ones
//   node tools/tests_for.mjs pub/home.js ... these files instead
//   node tools/tests_for.mjs --names         test file names only, one per line (for a loop)
//
// How a changed file picks its tests, first match wins nothing: every rule adds.
//   1. a changed test file runs itself
//   2. tests of the same app named after the file (pub/home.js: home_calm.py, home_end.py; staff6/team.js: staff6_team.py)
//   3. tests that name the file in their code (pub/home.js, staff6/team.js), unless more than MANY do: then it is shared
//   4. a shared file (an app's core, its data layer, its page) or one nothing names gets the app's smoke test
//   5. a .css or .html change also gets the app's layout budget (density.py for the public page, staff6_budget.py for v6)
// Staff v3 and v4 are frozen (R-291), so their tests never run here.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const MANY = 6;   // a file more tests than this mention is used everywhere: the smoke test covers it better than all of them

// Each app: which files are its, its test name prefix, its smoke test, its layout budget and its shared files.
const APPS = [
  { app: 'staff6', own: f => f.startsWith('staff6/') || f === 'staff6.html', prefix: 'staff6_',
    smoke: 'staff6_journeys.py', layout: 'APP=staff6 python3 tests/staff6_budget.py',
    shared: ['staff6/app.js', 'staff6/ui.js', 'staff6/data.js', 'staff6/model.js', 'staff6.html'] },
  { app: 'staff5', own: f => f.startsWith('staff5/') || f === 'staff5.html', prefix: 'staff5_',
    smoke: 'staff5_checks.py', layout: 'python3 tests/staff5_budget.py',
    shared: ['staff5/app.js', 'staff5/ui.js', 'staff5/data.js', 'staff5/model.js', 'staff5.html'] },
  { app: 'staff v2', own: f => f.startsWith('staff/') || ['staff.html', 'app.js', 'index.html', 'styles.css'].includes(f),
    prefix: 'staff_', smoke: 'staff_flows.py', layout: null,
    shared: ['staff/app.js', 'staff/ui.js', 'staff/data.js', 'staff/model.js', 'staff.html', 'app.js', 'index.html', 'styles.css'] },
  { app: 'public', own: f => f.startsWith('pub/') || /^(track|track-a|public|embed|404)\.html$/.test(f) || f === 'stops.js' || f === 'demo/snapshot.json',
    prefix: '', smoke: 'screens_smoke.py', layout: 'python3 tests/density.py --check',
    shared: ['pub/kernel.js', 'pub/core.js', 'pub/app.js', 'pub/ui.js', 'pub/fx.js', 'pub/fx.css', 'pub/base.css', 'pub/i18n.js',
      'pub/demo.js', 'pub/start.js', 'track.html', 'stops.js', 'demo/snapshot.json'] },
];
const FROZEN = /^(staff3|staff4)[_/.]/;
const testApp = t => t.startsWith('staff6_') ? 'staff6' : t.startsWith('staff5_') ? 'staff5' : FROZEN.test(t) ? null
  : t.startsWith('staff_') ? 'staff v2' : 'public';

const sh = (cmd, args) => { try { return execFileSync(cmd, args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch { return ''; } };
function changedFiles() {
  const base = sh('git', ['merge-base', 'HEAD', 'origin/main']).trim();
  const committed = base ? sh('git', ['diff', '--name-only', base, 'HEAD']) : '';
  const open = sh('git', ['status', '--porcelain']).split('\n').filter(Boolean).map(l => l.slice(3).split(' -> ').pop());
  return [...new Set(committed.split('\n').filter(Boolean).concat(open))];
}

// The command Tests runs for a test (its arguments), or the plain one for tests Tests does not run.
const ciRun = {};
try {
  for (const m of fs.readFileSync(path.join(ROOT, '.github/workflows/tests.yml'), 'utf8').matchAll(/run: ((?:\w+=\w+ )?python3 tests\/([\w]+\.py)[^\n]*)/g))
    ciRun[m[2]] ??= m[1].trim();
} catch {}
const cmdFor = t => ciRun[t] || `python3 tests/${t}`;

const tests = fs.readdirSync(path.join(ROOT, 'tests')).filter(f => f.endsWith('.py') && testApp(f));
const source = {};
const src = t => source[t] ??= fs.readFileSync(path.join(ROOT, 'tests', t), 'utf8');
const words = s => s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
const near = (a, b) => a === b || (a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a)));

function pick(files) {
  const out = new Map();   // test -> reasons
  const add = (t, why) => { if (!out.has(t)) out.set(t, []); if (!out.get(t).includes(why)) out.get(t).push(why); };
  const notes = [];
  for (const f of files) {
    if (/^tests\/[\w]+\.py$/.test(f)) { const t = f.slice(6); if (fs.existsSync(path.join(ROOT, f)) && testApp(t)) add(t, 'changed'); continue; }
    if (f.startsWith('tests/')) { notes.push(`${f} is a test helper: run the tests that use it`); continue; }
    const a = APPS.find(x => x.own(f));
    if (!a) continue;   // tools, docs, share pages, frozen apps: the quick checks before the push cover these
    const ext = path.extname(f), stem = path.basename(f, ext);
    if (a.layout && /\.(css|html)$/.test(f)) add(a.layout.match(/tests\/(\w+\.py)/)[1], `${f} (layout)`);
    if (a.shared.includes(f)) { add(a.smoke, `${f} (shared)`); continue; }
    const mine = tests.filter(t => testApp(t) === a.app);
    const byName = mine.filter(t => { const w = words(t.slice(a.prefix.length, -3)); return words(stem).some(s => w.some(x => near(s, x))); });
    const byCode = mine.filter(t => src(t).includes(f) || (a.app === 'public' && src(t).includes(`'${stem}${ext}`)));
    byName.forEach(t => add(t, `${f} (its name)`));
    if (byCode.length <= MANY) byCode.forEach(t => add(t, `${f} (named in the test)`));
    if (!byName.length && (byCode.length === 0 || byCode.length > MANY)) add(a.smoke, `${f} (${byCode.length ? 'used by many' : 'no test of its own'})`);
  }
  return { out, notes };
}

const argv = process.argv.slice(2), names = argv.includes('--names');
const given = argv.filter(a => !a.startsWith('--'));
const files = given.length ? given : changedFiles();
const { out, notes } = pick(files);
const layoutCmd = t => APPS.map(a => a.layout).find(l => l && l.includes(`tests/${t}`));
const line = t => layoutCmd(t) || cmdFor(t);
if (names) { for (const t of out.keys()) console.log(t); process.exit(0); }
if (!files.length) { console.log('Nothing changed against origin/main: no browser tests to run.'); process.exit(0); }
if (!out.size) {
  console.log(`No browser test covers the ${files.length} changed file(s) (tools, docs, share pages or frozen apps). The quick checks run before the push.`);
} else {
  console.log(`${out.size} browser test(s) for ${files.length} changed file(s), from frontend/ with python3 -m http.server 8832 running:`);
  const w = Math.max(...[...out.keys()].map(t => line(t).length));
  for (const [t, why] of out) console.log(`  ${line(t).padEnd(w)}   ${why.join('; ')}`);
}
for (const n of notes) console.log('  note: ' + n);
console.log('The full set runs in Tests after the push (about 10 minutes); a red run there is the next build\'s to fix (R-345).');
