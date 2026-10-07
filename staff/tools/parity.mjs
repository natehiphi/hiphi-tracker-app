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
  'rpc first_visit_funnel {weeks}', 'rpc first_visit_sources {weeks}', 'rpc visit_counts_weekly {weeks}', 'table site_cards', 'table partners',   // the first visit's numbers and links (067-069, R-023)
  'rpc triage_followed',   // Sort new bills: untracked bills the public follows (074, R-059)
  'table issue_helpers', 'rpc review_issue {p_action,p_id,p_note}', 'rpc tell_issue_owners',   // the issues' prep for 2027 (091, R-088)
  'rpc team_logins', 'rpc team_save {p_email,p_full_name,p_id,p_initials,p_is_active,p_is_admin,p_is_reviewer}', 'function team-admin',   // Session setup > Team (093, R-092)
  'table issue_links', 'table issue_link_choices',   // an issue's Related issues (095, R-094)
  'rpc team_set_approver {p_id,p_on}',   // the Team page's Approver switch (098, R-103)
  'rpc turn_off_user_list {p_link,p_reason}', 'rpc turned_off_user_lists', 'rpc turn_on_user_list {p_list}',   // Session setup > People's lists (103, R-013)
  'table public_errors_recent',   // Session setup: the public page's error reports (110, R-111)
  'table public_action_counts', 'table follower_counts',   // the public's response on hearings, the Week and the Public tab (R-117); the stored follower count since Z1-7
  'table ab_tests', 'rpc ab_results',   // Session setup > Tests: the public page's A/B tests (116, R-135)
  'rpc suggest_summary {weeks}',   // First visit > Suggested bills (118, R-094)
  'table bill_drafts',   // a bill's Public tab: what each draft changed (120, R-060)
  'rpc profile_rollup',   // Supporters: how supporters describe themselves, counts only (130, R-156)
  'table tester_paths']);   // the tester sheet: what testers did (150, R-193)   // Supporters: how supporters describe themselves, counts only (130, R-156)
const cur = calls(read('app.js')), v2 = new Set([...calls(read('staff/data.js')), ...calls(read('staff/model.js'))].filter(x => !V2_ONLY.has(x)));
// Calls the current app makes only from its screens (none expected: every call lives in DB) would show up here.
const onlyCur = [...cur].filter(x => !v2.has(x)), onlyV2 = [...v2].filter(x => !cur.has(x));
if (onlyCur.length || onlyV2.length) {
  if (onlyCur.length) console.log('Only in app.js:\n  ' + onlyCur.join('\n  '));
  if (onlyV2.length) console.log('Only in staff v2:\n  ' + onlyV2.join('\n  '));
  process.exit(1);
}
console.log(`parity ok: ${cur.size} Supabase calls match`);
