// Staff v6 · Preview as the public sees it (R-380, Nate 12 Nov). Staff edit what the public sees (a bill's Public tab, a list,
// an issue), and since R-376 a teammate's change waits for an admin. This opens the real public page with the words laid over
// it, before anything is saved or approved. No database write: it leaves a note in this browser's storage and opens
// track.html?preview=1 in a new tab; pub/preview.js reads the note (only when the address says preview=1 and the note is
// under 30 minutes old), lays the words over the page's own data and shows the "Preview, not live" band.
// The note: { kind: 'bill'|'issue'|'list', id, fields (staff column names), list?: { title, description, icon, slug, bills: [{ id, note }] }, at }.
// (The age is told by performance.timeOrigin, the real clock: the practice copy moves Date.now().)
// A list always travels with its bills, in order, because a draft list has no public page to ask for them.
import { S, DEMO } from './data.js';
import { PUBLIC_APP, billById } from './model.js';
import { toast } from './ui.js';

const KEY = 'hiphi-preview';
// The public page's address for the thing, the way the "Open the public page" links build it. A draft list has no slug on
// the public page yet, so it travels under its own (or "preview"): pub/preview.js draws it from the note.
function route(kind, id, list) {
  if (kind === 'bill') { const b = billById(id); return b ? `#/bill/${b.session_year ? b.session_year + '/' : ''}${String(b.bill_number).replace(/\s/g, '')}` : ''; }
  if (kind === 'issue') { const i = (S.issues || []).find(x => x.id === id); return i ? `#/issue/${encodeURIComponent(i.slug)}` : ''; }
  return `#list=${list?.slug || 'preview'}`;
}
// A list as staff keep it, with a waiting change's words laid over it.
export function listNote(l, over = {}) {
  const rows = (S.listBills || []).filter(x => x.list_id === l.id)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || String(a.added_at || '').localeCompare(String(b.added_at || '')))
    .filter(x => billById(x.bill_id));
  return { title: over.title ?? l.title, description: over.description ?? l.description ?? '', icon: over.icon ?? l.icon ?? null, slug: over.slug || l.slug || '',
    bills: rows.map(x => ({ id: x.bill_id, note: x.note || null })) };
}
export function openPreview({ kind, id, fields = {}, list } = {}) {
  if (kind === 'list' && !list) { const l = (S.lists || []).find(x => x.id === id); if (l) list = listNote(l, fields); }
  const hash = route(kind, id, list);
  if (!hash) { toast('That one is not on the public page to preview.'); return false; }
  try { localStorage.setItem(KEY, JSON.stringify({ kind, id, fields, ...(list ? { list } : {}), at: Math.round(performance.timeOrigin + performance.now()) })); }
  catch { toast('Your browser would not keep the preview. Allow site storage and try again.', { err: true }); return false; }
  // The practice copy carries demo=1 so the public page loads the same sandbox rows.
  window.open(`${PUBLIC_APP()}?preview=1${DEMO ? '&demo=1' : ''}${hash}`, '_blank', 'noopener');
  return true;
}
