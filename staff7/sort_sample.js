// PRACTICE COPY ONLY (?demo=1): SAMPLE values so that every part of the Sort new bills screens can be seen.
// The practice data has, for a new bill, no look-alike from last session, no introducers or committees, no "similar bill we track" and (but for one bill) no followers.
// The real queue (triage_queue) will not carry introducers, committees or a similar bill until the database says so; the screens show each of these rows ONLY when a bill has the value.
// Nothing here runs outside the practice copy, and every value below is marked `sample: true` on the bill so it can be told from data. Every name, committee and bill number is copied from a real
// bill already in the practice data (never typed in):
//   companions     a new bill whose Capitol title and text are word for word another new bill's (the House and Senate versions of one bill)
//   lookalike, sponsors, referrals   up to four new bills get a tracked practice bill as their look-alike, chosen as a believable one: the SAME chamber (House or Senate), a coalition the new bill
//                  matches, at least six topic words in common, and its own title's words all in the new bill's text; its introducers and committees are copied from it. A new bill with no such bill gets nothing.
//   similar        a second tracked bill that shares at least twelve topic words with the new bill and whose title words are all in the new bill's text (another one than the look-alike)
//   followers      the first two of those bills get 3 and 1 followers (the practice copy's followed list already holds one bill with 4)
import { S, DEMO } from '../staff6/data.js';
import { wordsOf } from '../staff6/suggest_issue.js';

let twins = null;
const byText = () => {
  if (twins) return twins;
  twins = new Map();
  for (const b of S.snapshot?.index || []) { if (!/^(HB|SB)\d+$/.test(b.bill_number)) continue; const k = (b.title || '') + '|' + (b.description || ''); (twins.get(k) || twins.set(k, []).get(k)).push(b.bill_number); }
  return twins;
};
const numPart = r => +String(r.bill_number).replace(/\D/g, '');

const chamber = no => /^SB/.test(no) ? 'S' : 'H';
const textOf = b => `${b.title || ''} ${b.description || ''}`;
let memo = null;
function build(rows) {
  const donors = (S.bills || []).filter(b => b.tracked !== false && (S.billCampaigns?.[b.id] || []).length && (b.sponsors || []).length && (b.referrals || []).length).map(b => ({ b, w: new Set(wordsOf(textOf(b))), t: wordsOf(b.title), c: S.billCampaigns[b.id] }));
  const named = (d, w) => d.t.length > 0 && d.t.every(x => w.includes(x));   // the donor's own title words ("Medicaid", "driving under the influence") all appear in the new bill's text
  const tw = byText(), out = new Map(), scored = [];
  for (const r of rows) {
    if (!/^(HB|SB)\d+$/.test(r.bill_number) || !(r.matches || []).length || String(r.description || '').trim().length < 80) continue;
    const w = wordsOf(textOf(r)), home = (r.matches || []).map(m => m.campaign_id);
    const ds = donors.filter(d => chamber(d.b.bill_number) === chamber(r.bill_number) && d.c.some(c => home.includes(c))).map(d => ({ d, n: w.filter(x => d.w.has(x)).length })).filter(x => x.n >= 6 && named(x.d, w)).sort((a, b) => b.n - a.n);
    if (ds.length) scored.push({ r, ds, twin: (tw.get((r.title || '') + '|' + (r.description || '')) || []).some(n => n !== r.bill_number), n: ds[0].n });
  }
  scored.sort((a, b) => (b.twin - a.twin) * 2 + (b.n - a.n) || numPart(a.r) - numPart(b.r));
  const used = new Set();
  for (const x of scored) {
    if (out.size >= 4) break; const d = x.ds.find(y => !used.has(y.d.b.id)); if (!d) continue; used.add(d.d.b.id);
    const wl = wordsOf(textOf(x.r)), w = new Set(wl), simil = donors.filter(y => y.b.id !== d.d.b.id && named(y, wl) && wordsOf(textOf(y.b)).filter(z => w.has(z)).length >= 12)[0];
    const c = (S.campaigns || []).find(k => k.id === d.d.c[0]);
    out.set(x.r.bill_number, { lookalike: { id: d.d.b.id, bill_number: d.d.b.bill_number, session_year: 2025, position: d.d.b.position, priority: d.d.b.priority, coalition: c ? c.name : null, similarity: 0.6 }, sponsors: d.d.b.sponsors, referrals: d.d.b.referrals, ...(simil ? { similar: { id: simil.b.id } } : {}), ...(out.size < 2 ? { followers: [3, 1][out.size] } : {}) });
  }
  return out;
}

export function addSamples(rows) {
  if (!DEMO || !rows || !rows.length) return rows;
  const tw = byText(); if (!memo && rows.length >= 50) memo = build(rows);   // chosen once, from the first full list (the followed list is only a few bills)
  const mm = memo || new Map();
  return rows.map(r => {
    if (r.sample) return r;
    let o = r; const own = (k, v) => { if (o === r) o = { ...r }; o[k] = v; o.sample = true; };
    const same = (tw.get((r.title || '') + '|' + (r.description || '')) || []).filter(n => n !== r.bill_number);
    if (same.length && !(r.companions || []).length) own('companions', same);
    const m = mm.get(r.bill_number); if (m) for (const [k, v] of Object.entries(m)) own(k, v);
    return o;
  });
}
