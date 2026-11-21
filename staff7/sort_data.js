// Staff7 Sort new bills (R-398), the data side: who sorts, the queue, the groups, what a bill's four fields start on, and the decisions made in this visit.
// No page is drawn here (sort.js draws). State lives HERE, outside the DOM, because render() replaces #app on every render and on a timed tick:
// the queue, the decisions ("Just sorted"), the bills skipped for now, and what a person chose on each bill's fields.
// The queue is read with the data layer's own calls (DB.triageQueue / triageFollowed / triageCounts, staff6/data.js): in the practice copy (?demo=1) they answer from memory and nothing leaves the page.
import { S, DB, DEMO, POSITIONS, advocate } from '../staff6/data.js';
import { suggestIssue } from '../staff6/suggest_issue.js';
import { sortCoalitions, openWeeks } from '../staff6/billshead.js';
import { companionsOf } from '../staff6/model.js';
import { eCig } from './issues.js';
import { first } from './steps.js';
import { addSamples } from './sort_sample.js';

// ---------------------------------------------------------------------------------- who sorts
// An admin sees every new bill; a coalition's owner or helper sees the bills that match their coalition's words (the database lets any active team member call the functions: this is the app's own rule).
export const isAdmin = me => !!me && me.is_active !== false && !!me.is_admin;
export const mineCamps = () => sortCoalitions();                       // the coalitions this person owns or helps on (My settings), that have words
export const sorts = me => !!me && me.is_active !== false && (isAdmin(me) || mineCamps().length > 0);
export const campOf = id => (S.campaigns || []).find(c => c.id === id) || null;
export const cname = c => c ? (c.public_name || c.name) : 'No coalition';

// ---------------------------------------------------------------------------------- words on word boundaries
// The same rule as staff6/triage.js realMatches (that function is not exported, and its file draws a whole page when imported, so it is written again here, kept the same): a coalition's word counts only when it
// STARTS a word ("aina" does not count inside "Sustainable"); a word may be the start of a longer one ("fluorid" finds "fluoridation"). The server matches anywhere inside a word; those matches are the "weak" ones.
const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const LEAD = '(?<![\\p{Ll}\\p{Lu}\\p{Lt}\\p{Lo}\\p{N}])';
export const wordRe = (terms, flags = 'iu') => new RegExp(`${LEAD}(?:${terms.map(reEsc).sort((a, b) => b.length - a.length).join('|')})[\\p{L}\\p{N}]*`, flags);
const textOf = r => `${r.title || ''} ${r.description || ''}`;
const MEMO = new WeakMap();
export function realMatches(r) {
  if (MEMO.has(r)) return MEMO.get(r);
  const txt = textOf(r), real = [], loose = [];
  for (const m of r.matches || []) { const terms = (m.terms || []).filter(k => k && wordRe([k]).test(txt)); if (terms.length) real.push({ ...m, terms }); else loose.push(m); }
  const out = { real, loose }; MEMO.set(r, out); return out;
}
// a row the server gave no matches for (the followed list never has any) gets them the way triage_queue makes them: a coalition's word found anywhere in the text
const withMatches = r => {
  if (r.matches) return r;
  const low = textOf(r).toLowerCase(), ms = (S.campaigns || []).filter(c => (c.keywords || []).length).map(c => ({ campaign_id: c.id, name: c.name, terms: c.keywords.filter(k => low.includes(String(k).toLowerCase())) })).filter(m => m.terms.length);
  return ms.length ? { ...r, matches: ms } : r;
};

// ---------------------------------------------------------------------------------- the queue (read once a visit, kept here)
// Q.matching / Q.all: { rows, capped, loading, failed }; Q.followed (admin); Q.counts. `key` says whose they are.
export const hooks7 = { render: null, draw: null };   // frame.js: draws the page again (a queue that arrives after the page is drawn)
export const Q = { key: '', matching: null, all: null, followed: null, counts: null, base: 0, refills: 0 };
const keyOf = me => `${me?.id || ''}|${isAdmin(me) ? 'admin' : mineCamps().join(',')}`;
const done = () => hooks7.render && hooks7.render({ tick: true });
function slot(name) { return Q[name] || (Q[name] = { rows: null, capped: false, loading: false, failed: false }); }
function fresh(me) {
  const k = keyOf(me);
  if (Q.key !== k) { Q.key = k; Q.matching = Q.all = Q.followed = Q.counts = null; }
  return k;
}
// the server's list for this person and mode: rows (one per bill) and whether it stopped at 400
async function pull(me, mode) {
  const admin = isAdmin(me), lists = await Promise.all(admin ? [DB.triageQueue(null, mode === 'matching')] : mineCamps().map(id => DB.triageQueue(id, true)));
  const seen = new Set(), rows = [];
  for (const l of lists) for (const r of l || []) if (!seen.has(r.id)) { seen.add(r.id); rows.push(r); }
  const known = S.demoTriaged;
  return { rows: addSamples(rows.filter(r => !(S.bills || []).some(b => b.id === r.id && b.tracked !== false) && !(DEMO && known?.has(r.id)))), capped: lists.some(l => (l || []).length >= 400) };
}
// mode: 'matching' | 'all' (all only for an admin). Starts the read once; draws again when it lands.
export function ensure(me, mode = 'matching') {
  if (!sorts(me)) return null;
  const k = fresh(me), s = slot(mode), admin = isAdmin(me);
  if (mode === 'all' && !admin) return slot('matching');
  if (!s.rows && !s.loading && !s.failed) {
    s.loading = true;
    pull(me, mode).then(r => { if (Q.key === k) { s.rows = r.rows; s.capped = r.capped; } }).catch(() => { if (Q.key === k) s.failed = true; }).finally(() => { if (Q.key === k) { s.loading = false; done(); } });
  }
  if (admin && !Q.followed) { Q.followed = { rows: null, loading: true }; DB.triageFollowed().then(rs => { if (Q.key === k) Q.followed = { rows: addSamples((rs || []).map(withMatches)) }; }, () => { if (Q.key === k) Q.followed = { rows: [] }; }).finally(done); }
  if (admin && !Q.counts) { Q.counts = { loading: true }; DB.triageCounts().then(c => { if (Q.key === k) { Q.counts = c || {}; Q.base = U.decisions.length; } }, () => { if (Q.key === k) Q.counts = {}; }).finally(done); }
  return s;
}
// The list stopped at 400 and the rows are running low: read the next ones (the server leaves out what was decided). Nothing says "All sorted" while this may bring more.
export const LOW = 20;
export function more(me, mode) { const s = slot(mode === 'all' && isAdmin(me) ? 'all' : 'matching'); return !!s.rows && (s.capped || !!s.refilling); }
export function refill(me, mode) {
  const k = Q.key, s = slot(mode === 'all' && isAdmin(me) ? 'all' : 'matching'); if (!s.rows || !s.capped || s.refilling || s.loading) return;
  s.refilling = true; Q.refills = (Q.refills || 0) + 1;
  pull(me, mode).then(r => { if (Q.key === k) { s.rows = r.rows; s.capped = r.capped; } }).catch(() => { if (Q.key === k) s.capped = false; }).finally(() => { if (Q.key === k) { s.refilling = false; hooks7.draw ? hooks7.draw({ tick: true }) : done(); } });
}
export const ready = (me, mode) => { const s = slot(mode === 'all' && isAdmin(me) ? 'all' : 'matching'); return !!s.rows && (!isAdmin(me) || (Q.followed?.rows && Q.counts && !Q.counts.loading)); };
export const failed = (me, mode) => !!slot(mode === 'all' && isAdmin(me) ? 'all' : 'matching').failed;
export function retry(me, mode) { const s = slot(mode === 'all' && isAdmin(me) ? 'all' : 'matching'); s.failed = false; ensure(me, mode); }

// ---------------------------------------------------------------------------------- this visit: decisions, skips, what was chosen on each bill
// words: what was typed in the New issue panel, per bill (the form's own state object), so a closed panel or a redraw never loses it (R-398 piece 10, S-11)
export const U = { decisions: [], skipped: [], pick: Object.create(null), words: Object.create(null), sel: '', wlY: 0, justOpen: false, busy: false, showAllBy: new Set() };
export const decided = id => U.decisions.some(d => d.id === id);

// ---------------------------------------------------------------------------------- one bill, as the list and the page need it
const num = r => String(r.bill_number || '').replace(/\s/g, '');
export const spaced = n => String(n || '').replace(/^([A-Z]+)\s*(\d)/, '$1 $2');
const SMALL = new Set(['to', 'of', 'the', 'and', 'for', 'in', 'on', 'a', 'an', 'or', 'by', 'with', 'at']);
// the Capitol's title is in capitals: "RELATING TO CANNABIS." reads "Relating to Cannabis"
export const capTitle = t => eCig(String(t || '').toLowerCase().replace(/[\p{L}][\p{L}'’ʻ]*/gu, (w, i) => i > 0 && SMALL.has(w) ? w : w[0].toUpperCase() + w.slice(1)).replace(/\bHawaii\b/g, 'Hawaiʻi').replace(/\.$/, ''));
const clean = t => eCig(String(t || '').replace(/\s+/g, ' ').trim());
// what the bill does, in the Capitol's words, ending where a sentence ends (the data cuts a long text off in the middle of a word)
export const tidy = t => { let s = clean(t); if (s && !/[.)]$/.test(s)) { const k = s.lastIndexOf('. '); s = k > 40 ? s.slice(0, k + 1) : s + '…'; } return s; };
// line 1 of a row: what the bill does (the Capitol's description), else the Capitol's own title; the page cuts it to two lines at a word (sort.js fit)
export const lineOne = r => clean(r.description) || capTitle(r.title);

const scopeIds = me => isAdmin(me) ? null : new Set(mineCamps());
// The coalition the bill will go under: the look-alike's coalition, else the first real word match, in the coalitions' order; a bill whose word is only inside another word is "weak".
// A person who sorts for some coalitions only (not an admin) is placed under one of THEIRS.
export function model(r, me) {
  const ids = scopeIds(me), inScope = c => !!c && (!ids || ids.has(c.id)), { real, loose } = realMatches(r);
  const order = c => (S.campaigns || []).findIndex(x => x.id === c.id);
  const realC = real.map(m => ({ c: campOf(m.campaign_id), t: m.terms })).filter(x => x.c).sort((a, b) => order(a.c) - order(b.c));
  const look = r.lookalike?.coalition ? (S.campaigns || []).find(c => c.name === r.lookalike.coalition) : null;
  const home = inScope(look) ? look : (realC.find(x => inScope(x.c)) || {}).c || null;
  const terms = [...new Set(realC.flatMap(x => x.t))];   // every real word match is marked on the page, whichever coalition it is for
  const weak = !home && loose.map(m => campOf(m.campaign_id)).find(inScope) || null;
  const followers = r.followers || 0;
  const group = followers && isAdmin(me) ? 'followed' : home ? 'c:' + home.id : weak ? 'weak' : 'none';
  const dflt = home || weak || null;
  return { r, id: r.id, no: num(r), real: realC, terms, home, camp: dflt, group, followers, also: realC.map(x => x.c).filter(c => !home || c.id !== home.id), comp: companionsOf(r) };
}

export const GROUP_LABEL = { followed: 'Followed on the public site', weak: 'Weak match', none: 'Matched no coalition' };
// The list for a person: groups in order (followed, one per coalition in the app's order, weak, none), one row per bill, the decided ones out, the skipped ones at the end of their group.
export function listFor(me, mode) {
  const s = slot(mode === 'all' && isAdmin(me) ? 'all' : 'matching'); if (!s.rows) return { groups: [], rows: [], capped: false };
  const fol = isAdmin(me) ? (Q.followed?.rows || []) : [], ids = new Set(), pool = [];
  const have = new Map(s.rows.map(r => [r.id, r]));
  for (const f of fol) { if (ids.has(f.id) || (S.bills || []).some(b => b.id === f.id && b.tracked !== false)) continue; ids.add(f.id); pool.push(have.has(f.id) ? { ...have.get(f.id), followers: f.followers, followed_at: f.followed_at } : f); }
  for (const r of s.rows) if (!ids.has(r.id)) { ids.add(r.id); pool.push(r); }
  const inQ = new Set(s.rows.map(r => r.id)), ms = pool.filter(r => !decided(r.id)).map((r, i) => ({ ...model(r, me), i, q: inQ.has(r.id) }));
  const rank = id => U.skipped.indexOf(id);
  const ord = c => c.startsWith('c:') ? 10 + (S.campaigns || []).findIndex(x => x.id === c.slice(2)) : { followed: 0, weak: 1000, none: 2000 }[c];
  ms.sort((a, b) => ord(a.group) - ord(b.group) || (rank(a.id) - rank(b.id)) || a.i - b.i);
  const groups = []; for (const m of ms) { let g = groups[groups.length - 1]; if (!g || g.k !== m.group) { g = { k: m.group, rows: [] }; groups.push(g); } g.rows.push(m); }
  for (const g of groups) g.label = g.k.startsWith('c:') ? cname(campOf(g.k.slice(2))) : GROUP_LABEL[g.k];
  return { groups, rows: ms, capped: s.capped };
}
// "400 of 5,912": the team's count of bills nobody has decided on, less what this visit decided; null when the count is not known (then the line says no "of")
export const totalAll = () => { const c = Q.counts; return c && c.undecided != null ? Math.max(0, c.undecided - (U.decisions.length - Q.base)) : null; };
export const otherN = n => { const t = totalAll(), c = Q.counts; return t == null || c.suggested == null ? 0 : Math.max(0, t - Math.max(n, c.suggested - (U.decisions.length - Q.base))); };
// the count the Issues row and the list say: the bills in the Matching words list (a bill that matches two coalitions counts once). When the server's list stopped at 400,
// an admin's exact number is the team's count of bills with matching words less this visit's decisions; with no such number it is "400+".
export function countOf(me) {
  if (!ready(me, 'matching')) return null;
  const l = listFor(me, 'matching');
  if (l.capped && isAdmin(me) && Q.counts && Q.counts.suggested != null) return { n: Math.max(l.rows.length, Q.counts.suggested - (U.decisions.length - Q.base)), capped: false };
  return { n: l.rows.length, capped: l.capped };
}
export const countText = c => `${c.capped ? '400+' : c.n.toLocaleString('en-US')} to sort`;
// the Issues row shows only to someone who sorts, and only while there is something to sort or in the opening weeks
export function entryLine(me) {
  if (!sorts(me)) return null;
  ensure(me, 'matching');
  const c = countOf(me); if (!c) return null;
  if (!c.n && !openWeeks()) return null;
  return { n: c.n, text: countText(c) };
}

// ---------------------------------------------------------------------------------- the four fields
export const POS_OPTS = [...POSITIONS.filter(p => p[0]), ['', 'No position yet']];
export const posLabel = v => (POS_OPTS.find(p => p[0] === v) || [])[1] || 'No position yet';
const active = id => { const a = id ? advocate(id) : null; return a && a.is_active !== false ? a : null; };
export const liveIssues = () => (S.issues || []).filter(i => !i.archived_at);
const sugs = new WeakMap();
export function suggestion(m) {
  if (!sugs.has(m.r)) sugs.set(m.r, suggestIssue(m.r, { issues: S.issues || [], billIssues: S.billIssues || [], lookalikeId: m.r.lookalike?.id || null })?.issue || null);
  return sugs.get(m.r);
}
// Who leads, and why: the sorter when the sorter owns the issue or owns or helps the coalition; otherwise the issue's owner, then the coalition's owner (active people only); then the sorter.
export function leadFor(me, issue, camp) {
  if ((issue && issue.owner_id === me.id) || (camp && (camp.owner_id === me.id || mineCamps().includes(camp.id)))) return { id: me.id, why: '' };
  if (issue && active(issue.owner_id)) return { id: issue.owner_id, why: `${first(advocate(issue.owner_id))} leads ${eCig(issue.name)}` };
  if (camp && active(camp.owner_id)) return { id: camp.owner_id, why: `${first(advocate(camp.owner_id))} leads ${cname(camp)}` };
  return { id: me.id, why: '' };
}
// What the four fields say for a bill now: the defaults, then what this person changed (U.pick). issueId: '' = not chosen yet (nothing suggested), 'none' = No issue yet.
export function fieldsOf(m, me) {
  const p = U.pick[m.id] || {}, sg = suggestion(m);
  const pos = p.pos !== undefined ? p.pos : 'monitor';
  const issueId = p.issue !== undefined ? p.issue : sg ? sg.id : '';
  const campId = p.camp !== undefined ? p.camp : m.camp ? m.camp.id : '';
  const issue = issueId && issueId !== 'none' ? liveIssues().find(i => i.id === issueId) || null : null, camp = campOf(campId);
  const auto = leadFor(me, issue, camp), leadId = p.lead !== undefined ? p.lead : auto.id;
  return { pos, issueId, issue, campId, camp, leadId, why: p.lead !== undefined ? '' : auto.why, sg, canTrack: !!issueId };
}
// how the chosen issue got there: the suggestion, a change from it, or put on by hand where nothing was suggested
export const viaOf = f => !f.sg ? 'staff' : f.issueId === f.sg.id ? 'suggested' : 'changed';
// Lead's choices: active people, the sorter first ("You"); two with the same first name say their initials
export function people(me) {
  const as = (S.advocates || []).filter(a => a.is_active !== false).sort((a, b) => (b.id === me.id) - (a.id === me.id) || first(a).localeCompare(first(b), 'en'));
  const dup = new Set(as.map(first).filter((n, i, all) => all.indexOf(n) !== i));
  return as.map(a => ({ id: a.id, label: a.id === me.id ? 'You' : dup.has(first(a)) ? `${first(a)} (${a.initials})` : first(a) }));
}
export const leadName = (me, id) => id === me.id ? 'you' : first(advocate(id));
// The words of a decision: the toast, and the line under a bill in "Just sorted"
export function trackWords(m, f, me) {
  const l = f.leadId === me.id ? 'you lead' : `${leadName(me, f.leadId)} leads`;
  return `${posLabel(f.pos)}, ${f.issue ? 'on ' + eCig(f.issue.name) : 'no issue yet'}, ${l}`;
}

// ---------------------------------------------------------------------------------- deciding (the data layer's own calls; the practice copy keeps it all in memory)
export async function track(m, me) {
  const f = fieldsOf(m, me);
  const out = await DB.triageTrackTeam(m.r, { campaignId: f.campId || null, position: f.pos || null, issueId: f.issue ? f.issue.id : null, leadId: f.leadId, issueVia: viaOf(f) });
  const g = out && Object.hasOwn(out, 'position') ? { ...f, pos: out.position || '' } : f;   // a bill that already had a position keeps it: say the one the database returned
  const d = { id: m.id, no: m.no, kind: 'track', m, text: `Tracked: ${trackWords(m, g, me)}`, toast: `${spaced(m.no)} tracked: ${trackWords(m, g, me)}. Not on the public site.` };
  U.decisions.unshift(d); return d;
}
export async function notForUs(m) {
  await DB.triageSkip(m.r);
  const d = { id: m.id, no: m.no, kind: 'skip', m, text: 'Off everyone’s list', toast: `${spaced(m.no)} is off everyone’s list.` };
  U.decisions.unshift(d); return d;
}
// Undo: Track's own undo puts back everything Track changed (and tells, plainly, when it cannot); Not for us uses triage_undo. Resolves with the words to say.
export async function undo(d) {
  if (d.kind === 'track') {
    const r = await DB.triageTrackTeamUndo(d.m.r);
    if (r && r.undone === false) { U.decisions = U.decisions.filter(x => x !== d); return { gone: true, said: `${spaced(d.no)} had nothing to undo. It is back in the list if it was put back already.` }; }
  } else await DB.triageUndo(d.m.r);
  U.decisions = U.decisions.filter(x => x !== d);
  for (const k of ['matching', 'all']) { const s = Q[k]; if (s && s.rows && !s.rows.some(r => r.id === d.id)) s.rows = [d.m.r, ...s.rows]; }   // a list read again since then no longer has it
  return { said: `${spaced(d.no)} is back in the list.` };
}
// the database's own sentences, said as they are ("This bill has changed since it was tracked."); anything else, plainly
export function plainError(e, what) {
  const m = String((e && e.message) || '').replace(/\s+/g, ' ').trim();
  if (/^staff only$/i.test(m)) return 'Only team members can sort bills.';
  if (/^[A-Z][^{}<>]{6,200}$/.test(m) && !/(sqlstate|violates|relation |column |function public|jwt|fetch|undefined|null)/i.test(m)) return `${what} ${/[.!]$/.test(m) ? m : m + '.'}`;
  return `${what} Nothing was changed. Try again.`;
}
export function skip(id) { U.skipped = U.skipped.filter(x => x !== id); U.skipped.push(id); }

// Real data only: the queue carries no introducers or committees, so when a bill is picked they are read for that one bill (as staff6 reads bills), kept, and shown when there. A failure hides the rows.
const EXTRA = new Map();
export function extra(r) {
  if (DEMO || !r || !r.id) return {};
  const e = EXTRA.get(r.id);
  if (e === undefined) {
    EXTRA.set(r.id, null);
    try {
      Promise.resolve(S.supa.from('bills').select('sponsors, referrals').eq('id', r.id).single())
        .then(res => { EXTRA.set(r.id, res && res.data ? { sponsors: res.data.sponsors || [], referrals: res.data.referrals || [] } : false); hooks7.draw && hooks7.draw({ tick: true }); }, () => EXTRA.set(r.id, false));
    } catch { EXTRA.set(r.id, false); }
  }
  return e || {};
}
