// The suggested bill (R-094): which bills may be suggested, how each one is scored, and the short list shown on Find
// (four) and Home (one). Pure: everything it needs comes in as arguments, so the app (pub/core.js suggestionList) and
// the replay of the 2026 session (backend tools/replay_suggestions.js) run exactly the same code. The plan, the research
// behind it and Nate's decisions of 9/29: backend docs/RECOMMENDATION-PLAN.md.
//
// Score = HIPHI's priority + fit to the person + timing + others speaking up - fatigue. The HIPHI part and the personal
// part have about the same range, so neither always wins; the short list then keeps one place for HIPHI's top pick and
// one for the person's own interests (Nate, decision 1).

// HIPHI's priority, the first visit's numbers (FIRST-VISIT-PLAN "Importance", Nate 9/21). start.js ranks issues by them.
export const WEIGHT = { strong: 40, support: 20, oppose: 15, neutral: 5, top: 30, promoted: 25, soon: 15 };
export const SOON_DAYS = 7;
// Fit to the person. A category is a broad interest only: two issues in one category need not be linked (Nate, decision
// 3), so a category match earns the same whether it was followed or ticked at the first visit. What does link two
// issues is the related-issues measure (backend tools/issue_similarity.js, migration 095, checked by Nate 9/30): a bill
// in an issue related to one the person follows is the closest fit there is.
export const FIT = { related: 60, interest: 30, acted: 10, sibling: -15, siblingFloor: -30 };
export const TIMING = { week: 15, twoDays: 20 };
export const PROOF = 5;                                  // ten or more people have acted (public counts start at 10)
export const FATIGUE = { lower: 3, stop: 5, points: -20 };   // days shown with no follow, act or dismiss (decision 4)
const DAY = 864e5, ACT_KINDS = new Set(['testimony', 'email', 'legislators']);

// HIPHI's side, from the bills that carry it (one bill, or an issue's moving bills): strongly supports 40, supports 20,
// only opposes 15, comments only 5. A strongly opposed bill with a hearing weighs 40 as well (Nate, decision 6): that is
// when HIPHI needs people against it. heard(b): does the bill have a hearing coming up.
export function sidePoints(bills, heard = () => false) {
  if (bills.some(b => b.hiphi_position === 'strongly_support' || (b.hiphi_position === 'strongly_oppose' && heard(b)))) return WEIGHT.strong;
  if (bills.length && bills.every(b => (b.hiphi_position || 'neutral') === 'neutral')) return WEIGHT.neutral;
  if (bills.length && bills.every(b => /oppose/.test(b.hiphi_position || ''))) return WEIGHT.oppose;
  return WEIGHT.support;
}

// Day of the week in Hawaiʻi, for counting "separate visits".
const hstDay = t => new Date(t - 10 * 3600e3).toISOString().slice(0, 10);

// One suggestion's score, or null when a hard rule leaves it out. c = { b, hearing, due } (due: when testimony is due,
// ms); any other fields on c are kept. p, the person:
//   now, issuesOf(b) -> issues, catsOf(b) -> category keys, catName(key),
//   follows / dismissed / skips: Sets of bill ids, against(b) -> they side against HIPHI on it,
//   relatedTo: Map of issue id -> the name of a followed issue it is related to (public_issue_links),
//   followCats (followed whole, or holding an issue they follow), pickedCats (first visit), likedCoalitions,
//   actedCats (categories of bills they wrote testimony on or emailed about), seen { billId: { h, days } },
//   people(b) -> how many have acted on it (null below ten).
export function scoreOne(c, p) {
  const { b, hearing, due } = c;
  if (!b.hiphi_position || b.hiphi_position === 'monitor' || !hearing || !(due > p.now)) return null;
  if (p.follows.has(b.id) || p.dismissed.has(b.id) || p.skips.has(b.id) || p.against(b)) return null;
  const issues = p.issuesOf(b), cats = p.catsOf(b);
  if (issues.some(i => i.first_visit === false)) return null;          // staff switched its issue out (decision 5)
  const seen = p.seen[b.id], today = hstDay(p.now);
  const shownDays = seen && seen.h === hearing.id ? seen.days.filter(d => d !== today).length : 0;   // a new hearing starts afresh
  if (shownDays >= FATIGUE.stop) return null;

  const top = issues.some(i => i.top_priority), side = sidePoints([b], () => true);
  const promoted = !!b.hiphi_recommended || issues.some(i => i.recommended);
  const hiphi = side + (top ? WEIGHT.top : 0) + (promoted ? WEIGHT.promoted : 0);
  const topPick = /^strongly_/.test(b.hiphi_position) || top;

  let fit = 0, fitWhy = '';
  const near = issues.map(i => p.relatedTo && p.relatedTo.get(i.id)).find(Boolean);
  const fc = cats.find(k => p.followCats.has(k)), pc = cats.find(k => p.pickedCats.has(k)), coal = (b.coalitions || []).find(n => p.likedCoalitions.has(n));
  if (near) { fit = FIT.related; fitWhy = `Close to ${near}, an issue you follow`; }
  else if (fc) { fit = FIT.interest; fitWhy = `In ${p.catName(fc)}, an area you follow`; }
  else if (pc) { fit = FIT.interest; fitWhy = 'Matches an issue you picked'; }
  else if (coal) { fit = FIT.interest; fitWhy = 'Similar to bills you follow'; }
  if (cats.some(k => p.actedCats.has(k))) { fit += FIT.acted; fitWhy ||= 'Like bills you’ve spoken up on'; }
  // "Not for me" on other bills of the same issue says a little about this one ("impression discounting").
  const sibs = new Set(issues.flatMap(i => i.bill_ids || []).filter(id => id !== b.id && (p.skips.has(id) || p.dismissed.has(id))));
  fit += Math.max(FIT.siblingFloor, sibs.size * FIT.sibling);

  const left = due - p.now, timing = left <= 2 * DAY ? TIMING.twoDays : left <= SOON_DAYS * DAY ? TIMING.week : 0;
  const n = p.people(b), proof = n != null && n >= 10 ? PROOF : 0;
  const fatigue = shownDays >= FATIGUE.lower ? FATIGUE.points : 0;
  // The reason line: the bigger of the personal part and HIPHI's named part. Staff's pre-tick is never named (Nate 9/22),
  // and the deadline is already on the card, so neither is a reason.
  const named = side + (top ? WEIGHT.top : 0);
  const why = fit > 0 && (fit >= named || !topPick) ? fitWhy : topPick ? 'One of HIPHI’s top priorities' : '';
  return { ...c, issues, cats, hiphi, fit, timing, proof, fatigue, topPick, why, when: due, score: hiphi + fit + timing + proof + fatigue };
}

export const byScore = (x, y) => y.score - x.score || x.when - y.when || x.b.bill_number.localeCompare(y.b.bill_number, 'en', { numeric: true });
export function rankAll(cands, p) { return cands.map(c => scoreOne(c, p)).filter(Boolean).sort(byScore); }

// The short list: best first, at most one bill per issue and two per category (three when the person cares about only
// one category: Steck's calibration), then one place kept for the person's own interests (third) and one for HIPHI's
// top pick (fourth), when the list has none. ranked: rankAll's output. likedCount: how many categories they care about.
export function shortList(ranked, n, likedCount = 0) {
  const issueKey = r => (r.issues[0] && r.issues[0].id) || r.b.id, catKey = r => r.cats[0] || null, cap = likedCount === 1 ? 3 : 2;
  const spreads = (list, r) => !list.some(x => issueKey(x) === issueKey(r)) && (!catKey(r) || list.filter(x => catKey(x) === catKey(r)).length < cap);
  const list = [];
  for (const r of ranked) { if (list.length >= n) break; if (spreads(list, r)) list.push(r); }
  if (list.length < n) for (const r of ranked) { if (list.length >= n) break; if (!list.includes(r) && !list.some(x => issueKey(x) === issueKey(r))) list.push(r); }
  // Keep a place: put the best r matching want() at slot i, unless the list already has one.
  const keep = (want, i) => {
    if (list.some(want)) return;
    const at = Math.min(i, list.length), rest = list.filter((_, k) => k !== at);
    const r = ranked.find(x => want(x) && !list.includes(x) && !rest.some(y => issueKey(y) === issueKey(x)));
    if (r) list.splice(at, at < list.length ? 1 : 0, r);
  };
  if (n >= 3) { keep(r => r.fit > 0, n - 2); keep(r => r.topPick, n - 1); }
  return list.slice(0, n);
}

// What the person has been shown, one entry per bill: the hearing it was for and the days it was shown on.
export function markShown(seen, list, now) {
  const today = hstDay(now);
  for (const r of list) {
    const h = r.hearing && r.hearing.id; if (!h) continue;
    const e = seen[r.b.id] && seen[r.b.id].h === h ? seen[r.b.id] : { h, days: [] };
    if (!e.days.includes(today)) e.days = [...e.days, today].slice(-FATIGUE.stop - 1);
    seen[r.b.id] = e;
  }
  return seen;
}
export const actedKind = k => ACT_KINDS.has(k);
