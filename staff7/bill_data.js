// What a bill's page needs beyond what is already in memory (R-398 Part B): the Capitol's lines and the team's (DB.timeline), every hearing of the bill (DB.billHearings), and on the practice copy
// a little sample team history (demo/bill_team.json). Asked for once per bill and kept for the visit; billExtras answers 'loading' the first time and the page is drawn again when the answer lands,
// the way find.js otherRow does it (and only if the person is still on the same address). Everything else Part B shows (the outcomes, testimony drafts, the team's conversation, the pinned note) is read
// from memory each time it is drawn, so it is never older than the rest of the page. Nothing here writes anything.
import { S, DB, DEMO } from '../staff6/data.js';
import { rerender } from './find.js';

export const cache = new Map();   // bill id -> 'loading' | 'failed' | { tl, hearings, outcomes, tf, at }
const STALE = 3 * 60 * 1000;
let team = null;   // the practice sample, fetched once and only in practice
const teamFile = () => DEMO ? (team ??= fetch('demo/bill_team.json?v=20261115a', { cache: 'force-cache' }).then(r => r.json()).catch(() => ({}))) : Promise.resolve({});

function load(b, quiet) {
  const at = location.hash; if (!quiet) cache.set(b.id, 'loading');
  Promise.all([DB.timeline(b.id), DB.billHearings(b.id), teamFile()])
    .then(([tl, bh, tf]) => cache.set(b.id, { tl: tl || [], hearings: bh.hearings || [], outcomes: bh.outcomes || [], tf: tf?.[b.bill_number] || {}, at: Date.now() }))
    .catch(() => { if (!quiet) cache.set(b.id, 'failed'); })
    .finally(() => { if (!quiet && location.hash === at) rerender(); });
}
export const retry = b => { cache.delete(b.id); rerender(); };

// 'loading' | 'failed' | { timeline, hearings, outcomes (by hearing id), drafts, messages, pinned }
export function billExtras(b) {
  const c = cache.get(b.id);
  if (!c) { load(b, false); return 'loading'; }
  if (c === 'loading' || c === 'failed') return c;
  if (Date.now() - c.at > STALE) { c.at = Date.now(); load(b, true); }   // quietly asked again; the old answer stays on the page
  const seen = new Set(), messages = [...(S.messages?.[b.id] || []), ...(c.tf.messages || []).map(m => ({ ...m, bill_id: b.id }))].filter(m => !seen.has(m.id) && seen.add(m.id));
  return {
    timeline: [...c.tl, ...(c.tf.timeline || []).map(r => ({ ...r, bill_id: b.id }))],
    hearings: [...new Map([...c.hearings, ...(S.hearings || []).filter(h => h.bill_id === b.id)].map(h => [h.id, h])).values()],   // the database's every hearing, with the ones in memory as they are now
    outcomes: { ...(S.outcomes || {}), ...Object.fromEntries(c.outcomes.map(o => [o.hearing_id, o])) },   // the practice copy's outcomes are in memory; the database's come with the hearings
    drafts: S.drafts?.[b.id] || [], messages, pinned: String(b.internal_notes || '').trim() || String(c.tf.pinned || '').trim(),
  };
}
// the timeline asked for again after the page itself added a row (a lead change), so the new line shows at once
export async function refreshTimeline(b) { const c = cache.get(b.id); if (c && typeof c === 'object') { try { c.tl = (await DB.timeline(b.id)) || c.tl; } catch { /* the old lines stay */ } } }
