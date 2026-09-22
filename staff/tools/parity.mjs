#!/usr/bin/env node
// Staff v2 talks to Supabase through a copy of the current app's data layer (staff/data.js, staff/model.js). This
// guard lists every table, RPC and edge function each side uses and fails when they differ, so a query changed in
// app.js is not silently left behind in v2.   node staff/tools/parity.mjs
import { readFileSync } from 'node:fs';
const read = f => readFileSync(new URL('../../' + f, import.meta.url), 'utf8');
const calls = src => {
  const out = new Set();
  for (const m of src.matchAll(/\.from\(\s*'([^']+)'\s*\)/g)) out.add('table ' + m[1]);
  for (const m of src.matchAll(/\.rpc\(\s*'([^']+)'\s*(?:,\s*\{([^}]*)\})?/g)) out.add('rpc ' + m[1] + (m[2] ? ' {' + [...m[2].matchAll(/(\w+)\s*:/g)].map(x => x[1]).sort().join(',') + '}' : ''));
  for (const m of src.matchAll(/functions\/v1\/([\w-]+)/g)) out.add('function ' + m[1]);
  return out;
};
// Calls only Staff v2 makes, on purpose: features built after the team chose to move to Staff v2 (9/20), which the
// current app, being retired, does not get. Everything else must still match.
const V2_ONLY = new Set(['table categories', 'table issues', 'table issue_categories', 'table bill_issues', 'rpc merge_issues {p_from,p_into}',   // Issues (063, R-018)
  'rpc first_visit_funnel {weeks}', 'rpc first_visit_sources {weeks}', 'table partners']);   // the first visit's numbers and links (067-069, R-023)
const cur = calls(read('app.js')), v2 = new Set([...calls(read('staff/data.js')), ...calls(read('staff/model.js'))].filter(x => !V2_ONLY.has(x)));
// Calls the current app makes only from its screens (none expected: every call lives in DB) would show up here.
const onlyCur = [...cur].filter(x => !v2.has(x)), onlyV2 = [...v2].filter(x => !cur.has(x));
if (onlyCur.length || onlyV2.length) {
  if (onlyCur.length) console.log('Only in app.js:\n  ' + onlyCur.join('\n  '));
  if (onlyV2.length) console.log('Only in staff v2:\n  ' + onlyV2.join('\n  '));
  process.exit(1);
}
console.log(`parity ok: ${cur.size} Supabase calls match`);
