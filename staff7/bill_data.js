// What a bill's page needs beyond what is already in memory (R-398 Part B): the Capitol's lines and the team's (DB.timeline), every hearing of the bill (DB.billHearings), and on the practice copy
// a little sample team history (demo/bill_team.json). Asked for once per bill and kept for the visit; billExtras answers 'loading' the first time and the page is drawn again when the answer lands,
// the way find.js otherRow does it (and only while the person is still on this bill). Everything else Part B shows (the outcomes, testimony drafts, the team's conversation, the pinned note) is read
// from memory each time it is drawn, so it is never older than the rest of the page. Nothing here writes anything.
import { S, DB, DEMO } from '../staff6/data.js';
import { redrawKeep } from './find.js';
import { bui } from './bill.js';

export const cache = new Map();   // bill id -> 'loading' | 'failed' | { tl, hearings, outcomes, tf, at }
const STALE = 3 * 60 * 1000;
let team = null, tfDone = null;   // the practice sample, fetched once and only in practice; tfDone is what it held once it has come
const teamFile = () => DEMO ? (team ??= fetch('demo/bill_team.json?v=20261116b', { cache: 'force-cache' }).then(r => r.json()).catch(() => ({})).then(t => (tfDone = t))) : Promise.resolve({});
// the history arriving (or failing) redraws the page the way the minute's tick does, and only while the person is still on THIS bill (the address may have changed its words, never its bill)
const onBill = b => !!bui.ctx && bui.ctx.b.id === b.id && /^#\/bill\//.test(location.hash);

function load(b, quiet) {
  if (!quiet) cache.set(b.id, 'loading');
  Promise.all([DB.timeline(b.id), DB.billHearings(b.id), teamFile(), Promise.resolve().then(() => DB.conversations({ billId: b.id })).catch(() => [])])   // the chair asks (legislator notes of this bill) ride along; their failure never fails the history
    .then(([tl, bh, tf, cv]) => cache.set(b.id, { tl: tl || [], hearings: bh.hearings || [], outcomes: bh.outcomes || [], tf: tf?.[b.bill_number] || {}, asks: (cv || []).filter(r => r.answer === 'asked'), at: Date.now() }))
    .catch(async () => { if (!quiet) { await teamFile().catch(() => {}); cache.set(b.id, 'failed'); } })   // the sample (practice) is waited for, so the notes drawn with the failure are complete
    .finally(() => { if (!quiet && onBill(b)) redrawKeep(); });
}
export const retry = b => { cache.delete(b.id); if (onBill(b)) redrawKeep(); };

// What the page can say without asking: the team's conversation, the pinned note and the testimony drafts (all in memory), for when the rest could not be loaded
export function memoryExtras(b) {
  const tf = tfDone?.[b.bill_number] || {}, seen = new Set();
  return { timeline: [], hearings: [], outcomes: {}, drafts: S.drafts?.[b.id] || [], messages: [...(S.messages?.[b.id] || []), ...(tf.messages || []).map(m => ({ ...m, bill_id: b.id }))].filter(m => !seen.has(m.id) && seen.add(m.id)), pinned: String(b.internal_notes || '').trim() || String(tf.pinned || '').trim() };
}

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

// What is already in memory about a bill, for the top of the page: it never asks and never waits. { hearings, outcomes (by hearing id), tl (the Capitol's and the team's lines), asks (chair asks, newest first) }
// until the history has landed, only the hearings and outcomes the app holds; tl and asks are empty then.
export function known(b) {
  const c = cache.get(b.id), mine = (S.hearings || []).filter(h => h.bill_id === b.id);
  if (!c || typeof c !== 'object') return { hearings: mine, outcomes: S.outcomes || {}, tl: [], asks: [] };
  return {
    hearings: [...new Map([...c.hearings, ...mine].map(h => [h.id, h])).values()],
    outcomes: { ...(S.outcomes || {}), ...Object.fromEntries(c.outcomes.map(o => [o.hearing_id, o])) },
    tl: [...c.tl, ...(c.tf.timeline || [])], asks: c.asks || [],
  };
}
// How many people follow the bill on the public site: the app's own counts when it has them, else (practice only) the little sample in demo/bill_team.json. undefined when nobody can say.
export function followersOf(b) {
  const n = S.pubCounts?.[b.id]?.followers; if (typeof n === 'number') return n;
  const m = DEMO ? tfDone?._followers?.[b.bill_number] : undefined; return typeof m === 'number' ? m : undefined;
}
