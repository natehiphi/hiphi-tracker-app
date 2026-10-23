// Staff v6 (R-336, spec 3.3, D12, V19, V30, V35): Bills' place head and the one Sort new bills number, shared by the three
// pages under Bills (bills.js: Bills and Muted; triage.js: Sort new bills). The head is the place's name as its h1 and one
// row of page tabs (ui.js sectionNav): Bills · Sort new bills (only in the opening weeks or while new bills wait, and only
// for whoever sorts them: admins and owners) · Muted (for owners and anyone with a muted bill). A row with one tab in it says
// nothing, so it is left out. Everyone else reaches both pages from More tools and the search box (spec 3.5, D8).
// The number (V19, V35: v5 said 788 in one spot and 5,398 in another): how many new bills match the words of the
// coalitions this person owns or helps on, the list Sort new bills opens on ("12 new bills match CTFH's words"). With no
// coalition of their own (an admin who owns none), the team's suggested count, said as such.
import { S, DB, DEADLINES } from './data.js';
import { sectionNav } from './ui.js';
import { myCoalitions } from './filters.js';

// The opening weeks of a session: every new bill needs a decision (v5's rule for its banner, kept).
export function openWeeks() {
  const c = (DEADLINES.introduced || [])[0]; if (!c) return false;
  const cut = new Date(c[1] + 'T23:59:59-10:00').getTime(), now = Date.now();
  return now > cut - 18 * 864e5 && now < cut + 3 * 864e5;
}
// Who sorts new bills: admins and owners (F94). An owner owns a coalition or a bill.
export const canSort = () => { const me = S.me; if (!me || me.is_active === false) return false;
  return !!me.is_admin || (S.campaigns || []).some(c => c.owner_id === me.id) || Object.values(S.assignments || {}).some(ids => (ids || []).includes(me.id)); };
// The coalitions this person sorts for: the ones they own, then the ones they help on (My settings), in the app's order.
export const sortCoalitions = () => { const me = S.me, mine = myCoalitions(), all = S.campaigns || [];
  return all.filter(c => (me && c.owner_id === me.id) || mine.has(c.id)).filter(c => (c.keywords || []).length).map(c => c.id); };
// "CTFH", "CTFH and HEAL", "your 3 coalitions"
export const coalitionWords = ids => { const n = ids.map(id => (S.campaigns || []).find(c => c.id === id)?.name).filter(Boolean);
  return n.length === 1 ? n[0] : n.length === 2 ? `${n[0]} and ${n[1]}` : `your ${n.length} coalitions`; };

// ---- the one number ----
// S.sortN: { key, n, capped, team, loading }. Read once a visit (and again after a decision on Sort new bills, which
// calls sortCountChanged). The team's counts come first (cheap, one call); a person's own queue is read only when new
// bills are waiting at all, one call per coalition of theirs (usually one).
const keyOf = () => `${S.me?.id || ''}|${sortCoalitions().join(',')}`;
export function loadSortCount(after) {
  if (!canSort()) return;
  const k = keyOf(), cur = S.sortN;
  if (cur && cur.key === k && (cur.loading || cur.n != null || cur.failed)) return;
  S.sortN = { key: k, n: null, loading: true };
  const team = S.triageCounts ? Promise.resolve(S.triageCounts) : DB.triageCounts().then(c => (S.triageCounts = c));
  team.then(async c => {
    const suggested = c?.suggested || 0, ids = sortCoalitions();
    if (!suggested && !openWeeks()) return { n: 0, team: !ids.length };
    if (!ids.length) return { n: suggested, team: true };
    const lists = await Promise.all(ids.map(id => DB.triageQueue(id, true)));
    const seen = new Set(); for (const rows of lists) for (const r of rows || []) seen.add(r.id);
    return { n: seen.size, capped: lists.some(r => (r || []).length >= 400), team: false };
  }).then(r => { if (S.sortN?.key === k) S.sortN = { key: k, ...r, loading: false }; after?.(); },
    () => { if (S.sortN?.key === k) S.sortN = { key: k, n: null, failed: true, loading: false }; });
}
// After a decision: the next visit to Bills reads it again (Sort new bills keeps its own running count meanwhile).
export const sortCountChanged = (delta = 0) => { const c = S.sortN; if (c && c.n != null) c.n = Math.max(0, c.n + delta); };
export const sortCount = () => { const c = S.sortN; return c && c.key === keyOf() && c.n != null ? c : null; };
// What the number means, in one line: "12 new bills match CTFH's words".
export function sortWords(c = sortCount()) {
  if (!c) return '';
  const n = `${c.n.toLocaleString()}${c.capped ? '+' : ''}`, s = c.n === 1 ? '' : 's', m = c.n === 1 ? 'matches' : 'match';
  if (c.team) return c.n ? `${n} new bill${s} ${m} a coalition’s words` : 'No new bills are waiting';
  const ids = sortCoalitions(), who = coalitionWords(ids);
  return c.n ? `${n} new bill${s} ${m} ${/^your /.test(who) ? `the words of ${who}` : `${who}’s words`}` : `No new bills match ${/^your /.test(who) ? `the words of ${who}` : `${who}’s words`}`;
}
// The Sort new bills tab shows in the opening weeks, or while new bills wait for this person (V30: one number, theirs).
export const showSortTab = () => canSort() && (openWeeks() || (sortCount()?.n || 0) > 0);
// Muted is a door for owners (they mute) and for anyone who has muted a bill.
export const showMutedTab = () => (S.mutes?.size || 0) > 0 || canSort();

// ---- the head: h1 "Bills" and the page tabs; `right` is the page's own controls (the scope switch) ----
export function billsHead(cur, { right = '', sub = '' } = {}) {
  const hide = [showSortTab() || cur === 'new' ? null : 'new', showMutedTab() || cur === 'muted' ? null : 'muted'].filter(Boolean);
  // On Sort new bills itself the number is the page's headline, so the tab does not say it a second time (A-14).
  const c = sortCount(), counts = { ...(c?.n && cur !== 'new' ? { new: `${c.n.toLocaleString()}${c.capped ? '+' : ''}` } : {}), ...(S.mutes?.size ? { muted: S.mutes.size } : {}) };
  const tabs = hide.length < 2 ? sectionNav('bills', cur, { hide, counts }) : '';
  return `<div class="sv-phead bl-head"><h1 class="sv-h1">Bills</h1>${sub ? `<div class="sv-pht"><p>${sub}</p></div>` : ''}<div class="sv-phr">${tabs}${right}</div></div>`;
}
// Redraws only the head's tabs when the number lands, so typing in the page's box or an open sheet is never disturbed.
export function refreshTabs(cur) {
  const head = document.querySelector('main .bl-head'); if (!head) return;
  const tmp = document.createElement('div'); tmp.innerHTML = billsHead(cur);
  const now = head.querySelector('.sv-secnav'), next = tmp.querySelector('.sv-secnav');
  if (now && next) now.replaceWith(next);
  else if (!now && next) head.querySelector('.sv-phr')?.prepend(next);
  // links drawn after the frame wired the page: route them as the frame does
  next?.querySelectorAll('a[href^="#/"]').forEach(a => a.addEventListener('click', e => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.defaultPrevented) return; e.preventDefault(); S.go(a.getAttribute('href')); }));
}
