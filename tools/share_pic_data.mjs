// The data readings the share pages and their checks share (R-183), so the live site, the practice copy, the gallery and
// tests/share_pics_test.mjs all see a bill the same way.

// The practice copy's data, shaped the way pub/demo.js shapes it for the page, read at the practice copy's day (Mon 16 Mar
// 2026, in session), for share pages built from demo/snapshot.json.
export function demoSets(snap) {
  const demoBills = snap.bills.filter(b => b.position).map(b => ({ ...b, hiphi_position: b.position, hiphi_summary: b.public_summary,
    hiphi_nickname: b.is_public ? b.nickname || null : null, hiphi_issues: null,
    hiphi_points: b.talking_points || null }));
  const byId = new Map(demoBills.map(b => [b.id, b])), billIds = {};
  for (const r of snap.billIssues || []) { const b = byId.get(r.bill_id); if (!b || b.hiphi_position === 'monitor') continue;
    (b.hiphi_issues ??= []).push(r.issue_id); (billIds[r.issue_id] ??= []).push(b.id); }
  const hearingsBy = new Map();
  for (const h of snap.hearings || []) { if (!hearingsBy.has(h.bill_id)) hearingsBy.set(h.bill_id, []); hearingsBy.get(h.bill_id).push(h); }
  const dl = snap.deadlines || [];
  return { bills: demoBills.sort((x, y) => (+x.session_year || 0) - (+y.session_year || 0)), hearingsBy,
    outcomes: Object.fromEntries((snap.outcomes || []).map(o => [o.hearing_id, o])),
    deadlineFor: b => key => { const d = dl.find(x => x.replaces === key && (x.bills || []).includes(b.bill_number)) || dl.filter(x => x.key === key && !(x.bills || []).length).slice(-1)[0];
      return d ? { label: d.label, date: d.deadline_date } : null; },
    committees: Object.fromEntries((snap.committees || []).map(c => [c.code, c])),
    issues: (snap.issues || []).map(i => ({ ...i, bill_ids: billIds[i.id] || [] })),
    now: Date.parse(snap.asof) };
}

// An issue's share words, as share_pics.readIt wants them, from rows of the words table (backend migration 155):
// { issue_id, slogan, before_text, after_text, island, slogan_ok, fact_ok }. onlyChecked: the live site is given nothing
// staff have not checked.
export function wordsMap(rows, { onlyChecked }) {
  const out = new Map();
  for (const r of rows || []) {
    const sOk = r.slogan_ok === true, fOk = r.fact_ok === true;
    const w = { slogan: (!onlyChecked || sOk) ? r.slogan || null : null, island: (!onlyChecked || sOk) && r.slogan ? (r.island || 'all') : null,
      before: (!onlyChecked || fOk) ? r.before_text || null : null, after: (!onlyChecked || fOk) ? r.after_text || null : null, slogan_ok: sOk, fact_ok: fOk };
    if (typeof w.island === 'string' && w.island !== 'all') w.island = w.island.split(',').map(x => x.trim()).filter(Boolean);
    out.set(r.issue_id, w);
  }
  return out;
}
