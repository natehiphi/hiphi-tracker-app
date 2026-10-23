// Staff v6 My issues and All issues: finding an issue by a bill number as the app prints it (R-336, the fresh-eyes review
// of ISSUES; issuestand.js searcher). v6 writes "HB 2121" with a space (D15); the filter must find it typed that way, in
// lower case, without the space, and by its digits alone. Also: a line that already names the bill is not told twice.
//   node tests/staff6_issues_test.mjs
import { readFileSync } from 'fs';

// ---- a little browser: just what the data layer and the shared parts touch when they load ----
const ROOT = new URL('../', import.meta.url);
const noop = () => {};
const store = () => { const m = new Map(); return { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), clear: () => m.clear() }; };
Object.assign(globalThis, {
  window: globalThis, location: { search: '?demo=1&as=NT', hash: '', origin: 'https://v6.test', pathname: '/staff6.html', href: 'https://v6.test/staff6.html?demo=1' },
  localStorage: store(), sessionStorage: store(), addEventListener: noop, removeEventListener: noop, matchMedia: () => ({ matches: true, addEventListener: noop }),
  document: { addEventListener: noop, querySelector: () => null, querySelectorAll: () => [], getElementById: () => null, body: null, createElement: () => ({ style: {} }) },
  history: { state: null, pushState: noop, replaceState: noop, back: noop }, requestAnimationFrame: f => setTimeout(f, 0), CSS: { escape: s => s },
  fetch: async url => { const f = new URL(String(url).split('?')[0], ROOT); return { ok: true, json: async () => JSON.parse(readFileSync(f)) }; },
});
if (!globalThis.navigator) globalThis.navigator = { userAgent: 'node' };

const D = await import('../staff6/data.js');
const { S } = D;
await D.DB.init?.().catch?.(() => {});
await D.demoInit();
const M = await import('../staff6/model.js');
const X = await import('../staff6/steps.js');

let pass = 0, fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); c ? pass++ : fail++; };
const RealDate = Object.getPrototypeOf(Date) === Function.prototype ? Date : Object.getPrototypeOf(Date);
// Pin the clock: every module reads the global Date when it runs, so this moves the whole app's "now".
const at = iso => { const T = new RealDate(iso).getTime(); globalThis.Date = class extends RealDate { constructor(...a) { a.length ? super(...a) : super(T); } static now() { return T; } }; M.FACTS.clear?.(); };
const MON9 = '2026-03-16T09:00:00-10:00';
at(MON9);
const I = await import('../staff6/issuestand.js');
S.me = S.advocates.find(a => a.initials === 'NT');
const list = (S.issues || []).filter(i => !i.archived_at).map(I.standOf);
const onBill = num => list.filter(x => (S.billIssues || []).some(l => l.issue_id === x.i.id && (S.bills.find(b => b.id === l.bill_id)?.bill_number || '').replace(/\s+/g, '') === num));
for (const [num, typed] of [['HB2121', ['HB 2121', 'hb 2121', 'HB2121', 'hb2121', '2121', 'Hb  2121']], ['SB2175', ['SB 2175', 'sb 2175', '2175']]]) {
  const want = onBill(num); ok(want.length > 0, `the practice data has an issue with ${num} on it (${want.length})`);
  for (const q of typed) {
    const f = I.searcher(q), hits = list.filter(x => f(x));
    ok(want.every(w => hits.includes(w)), `"${q}" finds every issue with ${num} on it (${hits.length} found)`);
  }
}
ok(I.joinNums('hb 2121 and SB 2175') === 'hb2121 and SB2175', 'joinNums joins a bill letter and its number');
// The matched row's line names the bill once: "Found by its bill HB 2121" is left out when the line already says HB 2121.
{ const x = onBill('HB2121')[0], m = I.searcher('HB 2121')(x), l = I.lineOf(x, { why: m.why });
  const n = (l.html.match(/HB(?:\u00a0|&nbsp;| )2121/g) || []).length;
  ok(n === 1, `the found row names HB 2121 once: ${l.html.replace(/<[^>]+>/g, '').slice(0, 90)}`); }
// A topic's count says what it counts (the critic: "3 hearings this week" counted issues).
ok(I.topicCount(list).every(t => !/hearings? this week/.test(t) || /with a hearing this week/.test(t)), `a topic's count reads "N with a hearing this week": ${I.topicCount(list).join(', ')}`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
