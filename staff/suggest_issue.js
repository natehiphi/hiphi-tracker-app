// The issue a new bill most likely belongs on, for Sort new bills (R-088 part 2, Nate's go 10/3; backend
// docs/PREP-2027-PLAN.md Part 2, migration 119). Pure: everything comes in as arguments, so tests/issue_suggest_test.mjs
// runs it on the practice copy's bills without a page.
//   1. The look-alike: the earlier session's bill Sort new bills already finds (Capitol text 45% alike or more) is on an
//      issue: that issue. In January most such bills are the 2026 bill filed again.
//   2. The words: the bill's title and description against each issue's name (three times the weight) and description,
//      each shared word counted by how few issues use it, so "e-cigarette" says more than "school". The best issue is named only
//      when it shares at least three words with the bill and leads the next one by a fifth; otherwise nothing is suggested
//      and staff pick. (One word was not enough: a National Guard bill naming "TRICARE Dental" got the issue on dental
//      licences.)
// Replayed on the practice copy (10/3): of the 248 bills of 2026 on an issue, the look-alike named one for 109 and was
// right for 91 (83%); the words named one for 142 and were right for 126 (89%, flattering, since the issues' descriptions
// were written from these bills); of the 486 bills on no issue, the words named one for 65. Staff see the suggestion in
// the panel and confirm it with Track; each outcome is kept (bill_issues.added_via).

const STOP = new Set(('relating that this with from into shall their which other state hawaii department program programs act bill bills ' +
  'makes establishes requires provides certain under each such have been also about more than when where these those within amends ' +
  'appropriates funds fund purposes public health county counties people persons person including include services service section').split(' '));
const stem = w => w.replace(/(ies|es|s|ing|ed)$/, '');
export const wordsOf = s => [...new Set((String(s || '').toLowerCase().replace(/[ʻ’']/g, '').match(/[a-z]{4,}/g) || [])
  .filter(w => !STOP.has(w)).map(stem))];

// The issues' words, worked out once per list of issues.
const prepared = new WeakMap();
function prepare(issues) {
  let p = prepared.get(issues); if (p) return p;
  const live = issues.filter(i => !i.archived_at), df = new Map();
  const rows = live.map(i => ({ i, name: new Set(wordsOf(i.name)), desc: new Set(wordsOf(i.description)) }));
  for (const r of rows) for (const w of new Set([...r.name, ...r.desc])) df.set(w, (df.get(w) || 0) + 1);
  p = { live, rows, idf: w => Math.log(1 + live.length / (df.get(w) || 1)) };
  prepared.set(issues, p); return p;
}

// bill: { id, title, description }; issues: [{ id, name, description, archived_at }]; billIssues: [{ bill_id, issue_id }];
// lookalikeId: the earlier bill's id, when Sort new bills found one. Returns { issue, how: 'lookalike' | 'words', words }
// or null.
export function suggestIssue(bill, { issues = [], billIssues = [], lookalikeId = null } = {}) {
  const { live, rows, idf } = prepare(issues);
  if (lookalikeId) {
    const link = billIssues.find(x => x.bill_id === lookalikeId && live.some(i => i.id === x.issue_id));
    if (link) return { issue: live.find(i => i.id === link.issue_id), how: 'lookalike', words: [] };
  }
  const text = `${bill.title || ''} ${bill.description || ''}`, bw = wordsOf(text), said = new Map();
  for (const w of String(text).toLowerCase().replace(/[ʻ’']/g, '').match(/[a-z]{4,}/g) || []) if (!said.has(stem(w))) said.set(stem(w), w);   // to show the bill's own word, not its stem
  let best = null, top = 0, second = 0;
  for (const r of rows) {
    let s = 0; const hit = [];
    for (const w of bw) { const v = ((r.name.has(w) ? 3 : 0) + (r.desc.has(w) ? 1 : 0)) * idf(w); if (v) { s += v; hit.push([w, v]); } }
    if (s > top) { second = top; top = s; best = { r, hit }; } else if (s > second) second = s;
  }
  if (!best || best.hit.length < 3 || top < second * 1.2) return null;
  return { issue: best.r.i, how: 'words', score: top, shared: best.hit.length, words: best.hit.sort((a, b) => b[1] - a[1]).slice(0, 3).map(([w]) => said.get(w) || w) };
}
