// Sort new bills' suggested issue (staff/suggest_issue.js, R-088 part 2): exact checks plus a replay on the practice
// copy's 2026 bills that have an issue. No server needed.   node tests/issue_suggest_test.mjs
import { readFileSync } from 'fs';
import { suggestIssue, wordsOf } from '../staff/suggest_issue.js';
const snap = JSON.parse(readFileSync(new URL('../demo/snapshot.json', import.meta.url)));
let pass = 0, fail = 0; const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); c ? pass++ : fail++; };
const issues = snap.issues, links = snap.billIssues;
ok(issues.length > 50 && links.length > 100, `the practice copy has issues and their bills (${issues.length}, ${links.length})`);
// 1. the look-alike's issue comes first, whatever the words say
const anyLink = links[0], other = issues.find(i => i.id !== anyLink.issue_id);
const s1 = suggestIssue({ title: other.name, description: other.description }, { issues, billIssues: links, lookalikeId: anyLink.bill_id });
ok(s1 && s1.how === 'lookalike' && s1.issue.id === anyLink.issue_id, 'a look-alike on an issue names that issue, over the words');
// 2. an archived issue is never suggested
const arch = issues.map(i => i.id === anyLink.issue_id ? { ...i, archived_at: '2026-09-01' } : i);
const s2 = suggestIssue({ title: 'x', description: '' }, { issues: arch, billIssues: links, lookalikeId: anyLink.bill_id });
ok(!s2 || s2.issue.id !== anyLink.issue_id, 'an archived issue is not suggested');
// 3. nothing in common: no suggestion
ok(suggestIssue({ title: 'Relating to the state flag', description: 'Requires the state to do certain things.' }, { issues, billIssues: links }) === null, 'words in common with no issue: nothing suggested');
// 4. one shared word is not enough (the National Guard bill that named "TRICARE Dental")
ok(suggestIssue({ title: 'Relating to the Hawaii National Guard', description: 'Authorizes the payment of allowances for TRICARE Reserve Select, TRICARE Dental Program, and vision coverage.' }, { issues, billIssues: [] }) === null, 'a single shared word ("dental") suggests nothing');
// 5. a real bill the words get right: the words shown are the bill's own, never a stem
const hit = links.map(l => ({ l, b: snap.bills.find(x => x.id === l.bill_id) })).filter(x => x.b)
  .map(x => ({ ...x, s: suggestIssue({ title: x.b.title, description: x.b.description }, { issues, billIssues: links.filter(l => l.bill_id !== x.b.id) }) }))
  .find(x => x.s && x.s.issue.id === x.l.issue_id);
ok(hit && hit.s.words.length === 3 && hit.s.words.every(w => `${hit.b.title} ${hit.b.description}`.toLowerCase().replace(/[ʻ’']/g, '').includes(w)), `${hit && hit.b.bill_number} gets its own issue (${hit && hit.s.issue.name}), from its own words (${hit && hit.s.words.join(', ')})`);
// 6. several issues about as close (a made-up e-cigarette bill, in the Legislature's own words): nothing is suggested rather than a coin toss
ok(suggestIssue({ title: 'Relating to vapes', description: 'Bans the sale of disposable vapes, flavored electronic smoking devices and e-liquids to protect youth.' }, { issues, billIssues: [] }) === null, 'a bill close to several e-cigarette issues alike: no suggestion, staff pick');
ok(wordsOf('Relating to Hawaiʻi schools and meals').join() === 'school,meal', `stop words and stems (${wordsOf('Relating to Hawaiʻi schools and meals').join()})`);
// 5. the replay: each 2026 bill with an issue, by its words alone, with its own link hidden
const byId = new Map(snap.bills.map(b => [b.id, b])); let named = 0, right = 0, n = 0;
for (const l of links) { const b = byId.get(l.bill_id); if (!b || b.session_year !== 2026) continue; n++;
  const s = suggestIssue({ title: b.title, description: b.description }, { issues, billIssues: links.filter(x => x.bill_id !== b.id) });
  if (s) { named++; if (s.issue.id === l.issue_id) right++; } }
ok(n > 100 && named / n >= 0.5, `the words name an issue for at least half the 2026 bills (${named} of ${n})`);
ok(named && right / named >= 0.8, `and the right one at least four times in five (${right} of ${named}, ${Math.round(100 * right / Math.max(1, named))}%)`);
// 6. bills on no issue (HIPHI monitors them, or never took them up): few get a suggestion
const onIssue = new Set(links.map(l => l.bill_id)), none = snap.bills.filter(b => b.session_year === 2026 && !onIssue.has(b.id));
const wrongly = none.filter(b => suggestIssue({ title: b.title, description: b.description }, { issues, billIssues: links })).length;
ok(none.length > 100 && wrongly / none.length < 0.2, `fewer than one in five bills on no issue is given one (${wrongly} of ${none.length})`);
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
