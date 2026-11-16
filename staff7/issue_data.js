// What the issue page needs beyond what is already in memory (R-398): the history of ALL the issue's bills in one read, the team's notes on the issue itself, and the issue's public link.
// Asked for once per issue and kept for the visit; the page is drawn again when an answer lands, and only while the person is still on that issue. Reads only, except addNote/deleteNote.
// Notes on the issue itself need the table `issue_notes` (id, issue_id, advocate_id, body, created_at, edited_at, deleted_at), which does not exist yet: in practice they live in memory
// (they vanish on reload); live, a missing table simply means no "Add a note" and no error.
import { S, DEMO, DEMO_TL, SESSION_OVER } from '../staff6/data.js';
import { PUBLIC_APP } from '../staff6/model.js';
import { redrawKeep } from './find.js';

// after the id comes `?`, `/` or the end, so one id that starts another's is not mistaken for it
const onIssue = id => [encodeURIComponent(id), String(id)].some(k => { const h = location.hash, p = `#/issue/${k}`; return h.startsWith(p) && (h.length === p.length || '?/'.includes(h[p.length])); });
let team = null;   // the practice sample's per-bill team history (demo/bill_team.json), fetched once
const teamFile = () => DEMO ? (team ??= fetch('demo/bill_team.json?v=20261116b', { cache: 'force-cache' }).then(r => r.json()).catch(() => ({}))) : Promise.resolve({});

// issue id -> 'loading' | 'failed' | { rows: activity rows of the bills, newest first, msgs: team messages, notes: the issue's own notes, notesOK }
const cache = new Map();
const practiceNotes = new Map();   // issue id -> notes made this visit (practice only)

async function load(issue, bills) {
  const ids = bills.map(b => b.id), nums = new Map(bills.map(b => [b.id, b.bill_number]));
  let rows = [], notes = [], notesOK = false;
  const tf = await teamFile();
  if (DEMO) {
    rows = DEMO_TL.filter(t => ids.includes(t.bill_id));
    notes = practiceNotes.get(issue.id) || []; notesOK = true;
  } else {
    const q = await S.supa.from('activity_log').select('*').in('bill_id', ids).order('occurred_at', { ascending: false }).limit(60);
    if (q.error) throw q.error;
    rows = q.data || [];
    const n = await S.supa.from('issue_notes').select('*').eq('issue_id', issue.id).is('deleted_at', null).order('created_at', { ascending: false });
    notesOK = !n.error; notes = n.error ? [] : n.data || [];   // a missing table is not an error: the page just has no "Add a note"
  }
  for (const [id, no] of nums) { const t = tf?.[no]; if (t?.timeline) rows = rows.concat(t.timeline.map(r => ({ ...r, bill_id: id }))); }
  const seen = new Set(), msgs = [];
  for (const b of bills) {
    const t = tf?.[b.bill_number];
    for (const m of [...(S.messages?.[b.id] || []), ...((t?.messages || []).map(x => ({ ...x, bill_id: b.id })))]) if (m.id == null || (!seen.has(m.id) && seen.add(m.id))) msgs.push({ ...m, bill_id: b.id });
  }
  return { rows, msgs, notes, notesOK };
}
// 'loading' the first time (and the page is drawn again when it lands), then what was read. The messages of a bill are in memory and are re-read each time, so a note added on a bill page shows.
export function feedOf(issue, bills) {
  const c = cache.get(issue.id);
  if (!c) {
    cache.set(issue.id, 'loading');
    load(issue, bills).then(v => cache.set(issue.id, v)).catch(() => cache.set(issue.id, 'failed')).finally(() => { if (onIssue(issue.id)) redrawKeep(); });
    return 'loading';
  }
  if (c === 'loading' || c === 'failed') return c;
  const seen = new Set(c.msgs.map(m => m.id)), more = [];
  for (const b of bills) for (const m of S.messages?.[b.id] || []) if (m.id != null && !seen.has(m.id)) more.push({ ...m, bill_id: b.id });
  return { ...c, msgs: [...c.msgs, ...more], notes: DEMO ? practiceNotes.get(issue.id) || [] : c.notes };
}
export const retryFeed = issue => { cache.delete(issue.id); redrawKeep(); };

export async function addNote(issue, body) {
  const n = { id: 'in' + Date.now(), issue_id: issue.id, advocate_id: S.me.id, body, created_at: new Date().toISOString(), edited_at: null, deleted_at: null };
  if (DEMO) { practiceNotes.set(issue.id, [n, ...(practiceNotes.get(issue.id) || [])]); return n; }   // practice: memory only, nothing is sent
  const { data, error } = await S.supa.from('issue_notes').insert({ issue_id: issue.id, advocate_id: S.me.id, body }).select().single();
  if (error) throw error;
  const c = cache.get(issue.id); if (c && typeof c === 'object') c.notes = [data, ...c.notes];
  return data;
}
export async function deleteNote(issue, n) {
  if (DEMO) { practiceNotes.set(issue.id, (practiceNotes.get(issue.id) || []).filter(x => x.id !== n.id)); return; }
  const { error } = await S.supa.from('issue_notes').update({ deleted_at: new Date().toISOString() }).eq('id', n.id);
  if (error) throw error;
  const c = cache.get(issue.id); if (c && typeof c === 'object') c.notes = c.notes.filter(x => x.id !== n.id);
}

// The public tracker's own page for an issue is <site>/i/<slug> (pub/core.js issueShareUrl; the /i/ folder holds one page per issue; the practice copy's are under /i/demo/).
export const shareUrl = issue => `${PUBLIC_APP().replace(/track\.html$/, '')}i/${DEMO && !SESSION_OVER ? 'demo/' : ''}${issue.slug}`;
// Is the issue on the public site? Its own published_at says so. How many follow it publicly is not in the staff data (only bills have a count), so no count is shown.
export const onPublicSite = issue => !!issue.published_at && !issue.archived_at;
