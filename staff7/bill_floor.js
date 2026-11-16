// The Capitol's floor votes on a bill, read from the history lines already in memory (R-398): "Passed Third Reading ..." in the House or the Senate. Counts only, never names, and only when the
// sentence gives them in full (the data cuts a long line, so a count that is not there means no count is shown, never a partial or a wrong one). Nothing here asks for anything or writes.
//   House form:  "Passed Third Reading ... voting no (1) and Representative(s) ... excused (3)."   (the yes count is not in it, so it is not said)
//   Senate form: "Report adopted; Passed Third Reading ... Ayes, 25; ... Noes, 0 (none). Excused, 0 (none)."
export function floorCounts(title) {
  const t = String(title || '').replace(/\s+/g, ' ');
  let m = /\bAyes,\s*(\d+)\b.*?\bNoes,\s*(\d+)\b.*?\bExcused,\s*(\d+)\b/i.exec(t);
  if (m) return `${m[1]} yes, ${m[2]} no, ${m[3]} excused`;
  const no = /voting no \((\d+)\)/i.exec(t), ex = /excused \((\d+)\)/i.exec(t);
  return no && ex ? `${no[1]} no, ${ex[1]} excused` : '';
}
// [{ chamber: 'House' | 'Senate', t (the day's moment), counts ('' when not read in full) }], one for each chamber and day, oldest first
export function floorVotes(timeline) {
  const out = [], seen = new Set();
  for (const r of timeline || []) {
    if (r.advocate_id && r.source !== 'auto') continue;   // the team's own lines are not the Capitol's
    const title = String(r.title || ''); if (!/^(report adopted;\s*)?passed third reading/i.test(title.trim())) continue;
    const ch = /Official action\s*-\s*(House|Senate)/i.exec(r.details || ''); if (!ch) continue;
    const chamber = /^s/i.test(ch[1]) ? 'Senate' : 'House', k = `${chamber}|${String(r.occurred_at).slice(0, 10)}`;
    if (seen.has(k)) continue; seen.add(k);
    out.push({ chamber, t: r.occurred_at, counts: floorCounts(title) });
  }
  return out.sort((a, b) => String(a.t).localeCompare(String(b.t)));
}
