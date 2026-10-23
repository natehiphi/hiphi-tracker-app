// Staff v2 · Bills: what the list shows (scope, search, filters) and the one Filter sheet (plan 3.4).
// The facet logic is the current app's: any value inside a group, every group together, a live count on every
// option, and options that would leave nothing are disabled. passFacets() walks model.js's facets and flags, reading
// three of them on the bill itself (see "what a filter means" below); this file adds the two groups the current app
// handled elsewhere (owner, which was the teammate scope, and committee) so every count in the sheet comes from one
// function, passAll().
import { S, DB, DEMO, esc, advocate, effStage, STAGES, isMine, isOwner, isMuted, hooks } from './data.js';
import { factsOf, facets, FLAGS, FACTS, diedish, codesOf, plain, STAGE_GLOSS, sponsorName, stopOf } from './model.js';   // FLAGS: passFacets
import { icon, btn, field, inlineErr, toast, openSheet, closeSheet, iconBtn, POS_ICON, POS_WORD, WHOSE } from './ui.js';
import { committeeName } from './steps.js';   // v6: a committee by its name, its code beside it (V05)

const KEY = 'hiphi2_bills' + (DEMO ? '_demo' : '');
// v3 (R-264): the row height is v3's own. Staff v2 shares KEY (one origin), so v3 never writes its row height there:
// v3 starts compact on a laptop, and Staff v2 keeps whatever its user chose. Someone who picks Roomy in v3 keeps it.
const ROWS_KEY = 'hiphi3_rows' + (DEMO ? '_demo' : '');
export const wideNow = () => matchMedia('(min-width: 900px)').matches;
// ui.js closes a menu sheet with history.back(), which lands a moment after the item's action starts. A page change or
// a new sheet opened before it lands is undone by it (the URL stays behind, the next sheet loses its Back entry). An
// action run from a menu waits for it first; when nothing is pending it goes straight on.
export const settled = () => !history.state?.sheet ? Promise.resolve() : new Promise(res => {
  const t = setTimeout(res, 400); addEventListener('popstate', () => { clearTimeout(t); setTimeout(res, 0); }, { once: true }); });

// A keyboard and a mouse (never a touch screen): where row keys and their hints belong.
export const hoverNow = () => { try { return matchMedia('(hover: hover) and (pointer: fine)').matches; } catch { return false; } };
// Typing in a field is never a shortcut.
export const typingIn = el => !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);

// ---- the pages under Bills (Sort new bills, Weekly memo, Muted bills) ----
// On a desktop the frame draws no back arrow, so each of these pages draws this link above its title (the assessment
// found no way back but the browser's button). Opened from the Bills list, it is a real Back, so the list returns
// where it was (the frame does that for data-back); opened from the sidebar or a link, it goes to the list.
// While a page renders, body[data-screen] still names the page before it (the frame sets it after render()).
const SUB = { key: '', fromList: false };
// `to` ({ href, label }): the page was opened from somewhere else that the link named (the memo's ?from=, R-022), so
// the way back goes there, and is real Back when the person came from inside the app, as hearing.js's does.
export function deskBack(key, to) {   // key: 'triage' | 'memo' | 'muted' (muted bills is a page of the 'bills' screen)
  const v = bl(), prev = document.body.dataset.screen || '';
  const again = SUB.key === key && (key === 'muted' ? prev === 'bills' && !!v.lastMuted : prev === key);   // a redraw of the same page
  if (!again) { SUB.key = key; SUB.fromList = prev === 'bills' && !v.lastMuted; }
  if (to) return `<a class="bl-deskback" href="${esc(to.href)}" data-back>${icon('chevron-left')}<span>${esc(to.label)}</span></a>`;
  return `<a class="bl-deskback" href="#/bills"${SUB.fromList ? ' data-back' : ''}>${icon('chevron-left')}<span>Bills</span></a>`;
}

// ---- whose bills: Mine, My coalitions, Team (R-022, decision 7; v3 calls Everyone "Team", R-264) ----
// Support staff help with whole coalitions rather than owning bills: Kris supports every coalition, Saya CTFH. Their
// choice lives in advocates.prefs.coalitions ('all', or a list of campaign ids) and is made in My settings. The third
// scope appears only for someone who supports at least one, so everyone else keeps the two they know.
// Asked for on every row the list filters, so the set is kept until the choice (or the coalitions) change. Read only.
let MC = null;
export const myCoalitions = () => {
  const c = S.me?.prefs?.coalitions;
  if (MC && MC.c === c && MC.camps === S.campaigns && MC.n === S.campaigns.length) return MC.set;
  const ids = S.campaigns.map(x => x.id);
  MC = { c, camps: S.campaigns, n: ids.length, set: new Set(c === 'all' ? ids : Array.isArray(c) ? c.filter(id => ids.includes(id)) : []) };
  return MC.set;
};
export const scopeOpts = () => [['me', WHOSE.mine], ...(myCoalitions().size ? [['coal', WHOSE.coal]] : []), ['all', WHOSE.team]];   // R-277 fix 14: ui.js WHOSE
// Somebody who owns no bill but supports a coalition starts on that coalition's bills: an empty "Mine" told Kris "You have
// no bills yet" in the busiest week of the session. v6 (spec 3.3, F83): owners open on Mine, people who own none on My
// coalitions, even when an issue they help on puts a bill or two in their Mine (Patti, Julie).
// Someone with nothing in Mine and no coalition to help on (Jess, a second approver) opens on Team: an empty Mine with a
// filter box, Filter and Select over nothing read as if the bills were missing (B-12).
export const defaultScope = () => !S.bills.some(isOwner) && myCoalitions().size ? 'coal' : !myCoalitions().size && !S.bills.some(isMine) ? 'all' : 'me';
const okScope = s => s === 'all' || s === 'me' || (s === 'coal' && myCoalitions().size > 0);

// Everything the Bills screens remember. The shared facet sets (S.pris, S.poss…) live on S because model.js's facets
// read them there; the rest lives on S.bl so nothing else in the app is touched.
export function bl() {
  if (!S.bl) {
    S.bl = { scope: 'me', q: '', owners: new Set(), cmtes: new Set(), issues: new Set(), spons: new Set(), due: '', folds: {}, cols: new Set(), compact: true, selecting: false, sel: new Set(), sort: null, fopen: new Set(), view: '', look: null };
    load();
  }
  // Coalitions can be given up in My settings while the list is on "My coalitions"; it falls back rather than going blank.
  if (S.bl.scope === 'coal' && !myCoalitions().size) S.bl.scope = defaultScope();
  return S.bl;
}
// The starting state, and the shape a saved view stores: every filter, and nothing about how the table is drawn
// (columns and row height are how this person likes to read, not what they are looking at).
export const BLANK = { scope: 'me', pris: [], poss: [], stands: [], camps: [], lsts: [], hearF: false, riskF: false, tripleF: false, stageF: '', owners: [], cmtes: [], issues: [], spons: [], due: '' };
export function viewState() {
  const v = bl();
  return { scope: v.scope, pris: [...S.pris], poss: [...S.poss], stands: [...S.stands], camps: [...S.camps], lsts: [...S.lsts],
    hearF: S.hearF, riskF: S.riskF, tripleF: S.tripleF, stageF: S.stageF, owners: [...v.owners], cmtes: [...v.cmtes], issues: [...v.issues], spons: [...v.spons], due: v.due || '' };
}
// Ids are checked against what exists today, so a deleted coalition or teammate never leaves a filter nobody can see
// (a saved view made in January is read the same way in April).
function applyFilters(f) {
  const v = bl();
  S.pris = new Set(); S.poss = new Set(); S.stands = new Set(); S.camps = new Set(); S.lsts = new Set();
  S.hearF = false; S.riskF = false; S.tripleF = false; S.aliveF = false; S.stageF = '';   // "Still alive" is the folded Did not advance group now
  v.owners = new Set(); v.cmtes = new Set(); v.issues = new Set(); v.spons = new Set(); v.due = '';
  if (!f) return;
  const ok = (arr, pool) => (arr || []).filter(x => pool.includes(x));
  v.scope = okScope(f.scope) ? f.scope : 'me';
  // A saved Priority filter is dropped: priority follows the position since R-175, and no saved view had one (10/5).
  S.poss = new Set(ok(f.poss, ['strongly_support', 'support', 'support_amend', 'strongly_oppose', 'oppose', 'neutral', 'monitor', 'none']));
  S.stands = new Set(ok(f.stands, ['a', 'b', 'c', 'done', 'dead']));
  S.camps = new Set(ok(f.camps, S.campaigns.map(c => c.id)));
  S.lsts = new Set(ok(f.lsts, (S.lists || []).map(l => l.id)));
  S.hearF = !!f.hearF; S.riskF = !!f.riskF; S.tripleF = !!f.tripleF;
  S.stageF = STAGES.some(([k]) => k === f.stageF) ? f.stageF : '';
  v.owners = new Set(ok(f.owners, ['none', ...S.advocates.map(a => a.id)]));
  v.cmtes = new Set(f.cmtes || []);
  v.issues = new Set(ok(f.issues, (S.issues || []).filter(i => !i.archived_at).map(i => String(i.id))));   // a retired issue drops out, as a deleted teammate does
  v.spons = new Set((f.spons || []).filter(x => typeof x === 'string'));
  // A deadline that has passed is no filter any more (a saved view or the remembered list from last week).
  v.due = /^\d{4}-\d{2}-\d{2}$/.test(f.due || '') && f.due >= hstToday() ? f.due : '';
}
function load() {
  const v = S.bl;
  let f = null; try { f = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { /* private window: start clean */ }
  applyFilters(f);
  v.compact = loadRows();
  // A "Mine" with nothing in it is never where someone who supports a coalition should land (see defaultScope).
  if (!f || (v.scope === 'me' && !S.bills.some(isMine))) v.scope = defaultScope();   // a remembered Mine with nothing in it
  if (!f) return;
  const ok = (arr, pool) => (arr || []).filter(x => pool.includes(x));
  v.cols = new Set(ok(f.cols, ['cmte', 'coal', 'last', 'pulse']));
  v.v2compact = !!f.compact;   // Staff v2's own choice, written back as it was read
  v.view = typeof f.view === 'string' ? f.view : '';
}
function loadRows() { try { return localStorage.getItem(ROWS_KEY) !== 'roomy'; } catch { return true; } }
export function save() {
  const v = bl();
  try { localStorage.setItem(KEY, JSON.stringify({ ...viewState(), cols: [...v.cols], compact: !!v.v2compact, view: v.view || '' })); } catch { /* storage full or blocked: filters just are not remembered */ }
}
// Compact or roomy rows (v3): remembered on their own, so Staff v2 is never switched along with it.
export function setCompact(on) {
  bl().compact = !!on;
  try { localStorage.setItem(ROWS_KEY, on ? 'compact' : 'roomy'); } catch { /* this visit only */ }
}

// ---- the list ----
export const cmtesOf = b => [...new Set([...(b.referrals || []), b.committee].flatMap(codesOf))];
// Issues and sponsors (R-210, Nate 10/8: the Bills filter had neither). An issue is the team's own grouping (Outreach >
// Issues); a sponsor is anyone the Capitol lists on the bill, lead or not. Both are looked up for every bill several
// times a paint (every option in the sheet counts the bills it would leave), so each is built once per pass over the
// list and dropped with freshFacts() when issues, sponsors or the bills change.
let ISS = null;
const issuesOf = b => { if (!ISS) { ISS = new Map(); const live = new Set((S.issues || []).filter(i => !i.archived_at).map(i => String(i.id)));
    for (const x of S.billIssues || []) { const id = String(x.issue_id); if (live.has(id)) (ISS.get(x.bill_id) || ISS.set(x.bill_id, []).get(x.bill_id)).push(id); } }
  return ISS.get(b.id) || []; };
// The Capitol lists "LEE, M." as two sponsors (bill.js's sponsorList does the same): the initial goes back on its name.
export const sponsOf = b => { const out = [];
  for (const s of b.sponsors || []) { const n = String(s.n || s.name || s).replace(/\(.*?\)/g, '').trim(); if (/^[A-Z]\.$/.test(n) && out.length) out[out.length - 1] += ', ' + n; else if (n) out.push(n); }
  return [...new Set(out.map(n => n.toUpperCase()))]; };
const issueName = id => (S.issues || []).find(i => String(i.id) === String(id))?.name || 'Issue';
// The words people type for what a bill calls something else (pub/find.js SYN, kept in step by hand: that module brings the
// whole public app with it). Someone who types "vape" finds the e-cigarette bills (C-10), "kids" the keiki ones.
const SYN = [
  ['vape', 'vaping', 'vapor', 'e-cig', 'ecig', 'e-cigarette', 'ecigarette', 'electronic smoking', 'electronic cigarette', 'flavored'],
  ['keiki', 'kids', 'children', 'child', 'youth'], ['lunch', 'meal'],
  ['soda', 'sugary drink', 'sugary beverage', 'sugar-sweetened', 'sweetened beverage'],
];
const synOf = w => SYN.find(g => g.some(t => t === w || t === w + 's' || w === t + 's' || (w.length >= 4 && t.startsWith(w)))) || [w];
let TXT = new WeakMap();   // each bill's words, once a paint (every option in the sheet counts the list again)
const textOf = b => { let t = TXT.get(b); if (t == null) TXT.set(b, t = [b.nickname, b.title, b.description, b.public_summary].map(x => plain(x)).join(' \n ')); return t; };
// The whole phrase first; else every word, each by itself or one of its synonyms.
const matchQ = (b, q) => { const n = q.replace(/\s/g, '').toLowerCase();
  if (b.bill_number.toLowerCase().includes(n)) return true;
  const t = textOf(b); if (t.includes(q)) return true;
  const words = q.split(/\s+/).filter(Boolean);
  return words.some(w => synOf(w).length > 1) && words.every(w => synOf(w).some(x => t.includes(x))); };
// Whose bills: Mine = owned or followed and not muted (the current app's isMine); My coalitions = every bill in a
// coalition you support, less the ones you muted (a mute is "off my lists"); Team = every tracked bill.
// Monitor bills that died stay out (234 of Nate's 289 monitor bills are dead clerical noise); a search finds them.
const inMyCoalition = b => { const mc = myCoalitions(); return (S.billCampaigns[b.id] || []).some(id => mc.has(id)); };
export function baseBills(scope = bl().scope) {
  const q = plain(bl().q.trim());
  const pool = scope === 'me' ? S.bills.filter(isMine) : scope === 'coal' ? S.bills.filter(b => !isMuted(b) && inMyCoalition(b)) : S.bills;
  return pool.filter(b => (!q || matchQ(b, q)) && (q || b.position !== 'monitor' || !diedish(b)));
}

// ---- what a filter means (R-022, decision 5, A-14: one meaning per word) ----
// Monitor is a position the team decided, and the list keeps monitored bills in a group of their own. So every other
// word on Bills counts bills with a position, and a word means the same thing wherever it appears. The sheet's
// "Hearing scheduled" is the strip's "Hearing scheduled", and "Hearing this week" is the part of it heard in the next
// 7 days (both used to count monitored bills too, so Nate saw "Hearing this week 17" beside "Hearing scheduled 8").
// "Monitoring" is only the bills the team monitors (the old "No position yet" chip counted them, because factsOf
// reads a missing position as monitor); "No position yet" means exactly that, and shows only when a tracked bill
// really has none. model.js's facets read factsOf as it is, so these three are answered on the bill itself.
export const posIs = (b, v) => v === 'none' ? !b.position : b.position === v;
export const hearWeek = (f, b) => f.hear && b.position !== 'monitor';
export const standIs = (f, b, v) => f.stand === v && (v === 'dead' || b.position !== 'monitor');
export const posWord = p => p === 'monitor' ? 'Monitoring' : p === 'none' || !p ? 'No position yet' : POS_WORD[p] || p;
const OWN_TEST = { poss: (f, b, v) => posIs(b, v), stands: (f, b, v) => standIs(f, b, v) };
function passFacets(b, skip) {
  const f = factsOf(b);
  for (const g of facets()) {
    const on = S[g.key]; if (g.key === skip || !on.size) continue;
    const own = OWN_TEST[g.key];
    if (![...on].some(v => own ? own(f, b, v) : g.has(f, v))) return false;
  }
  for (const [k, , , test] of FLAGS) if (k !== skip && S[k] && !(k === 'aliveF' && S.view === 'dead') && !(k === 'hearF' ? hearWeek(f, b) : test(f))) return false;
  return !S.stageF || effStage(b) === S.stageF;
}
const ownerHas = (b, o) => o === 'none' ? !(S.assignments[b.id] || []).length : (S.assignments[b.id] || []).includes(o);
// "N with no hearing yet" in Bills' deadline sentence (v3, R-264) is a link to exactly those bills: live, with a position,
// still in committee with no hearing, and racing that deadline. The same test as model.js's sessionGates noHearing, so
// the number in the sentence and the rows the link shows always agree. Worked out once per pass (see freshFacts).
let DUE = null;
const dueOf = b => { if (!DUE) DUE = new Map(); let d = DUE.get(b.id);
  if (d === undefined) { const st = b.position === 'monitor' || diedish(b) ? null : stopOf(b);
    d = st && st.column === 'a' && st.deadline && !st.deadline.missed ? st.deadline.date : ''; DUE.set(b.id, d); }
  return d; };
const hstToday = () => new Date(Date.now() - 10 * 36e5).toISOString().slice(0, 10);
// "Mon 3/30": the day a deadline falls on, as Bills says it.
export const dueDay = d => new Date(d + 'T12:00:00-10:00').toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric', timeZone: 'Pacific/Honolulu' }).replace(',', '');
export function passAll(b, skip) {
  const v = bl();
  if (!passFacets(b, skip)) return false;
  if (skip !== 'owners' && v.owners.size && ![...v.owners].some(o => ownerHas(b, o))) return false;
  if (skip !== 'cmtes' && v.cmtes.size && !cmtesOf(b).some(c => v.cmtes.has(c))) return false;
  if (skip !== 'issues' && v.issues.size && !issuesOf(b).some(i => v.issues.has(i))) return false;
  if (skip !== 'spons' && v.spons.size && !sponsOf(b).some(n => v.spons.has(n))) return false;
  if (skip !== 'due' && v.due && dueOf(b) !== v.due) return false;
  return true;
}
export const shownBills = (scope) => baseBills(scope).filter(b => passAll(b));
export const liveCount = list => list.filter(b => b.position !== 'monitor' && factsOf(b).stand !== 'dead').length;
// passFacets() has no "skip" for the one-value stage filter, so its own count lifts it for a moment (picking another
// stage replaces the current one, so each stage shows what it would give on its own).
const cnt = (list, skip, test) => {
  const st = S.stageF; if (skip === 'stageF') S.stageF = '';
  try { return list.filter(b => passAll(b, skip) && test(factsOf(b), b)).length; } finally { S.stageF = st; }
};
export const quickCount = (spec, test) => cnt(baseBills(), spec.split(':')[0], test);
export const freshFacts = () => { FACTS.clear(); ISS = null; DUE = null; TXT = new WeakMap(); };   // positions, coalitions and lists change under the list; facts are cheap to rebuild

// ---- what is switched on ----
// The quick chips are three of the same filters, one tap away. Muted is a place, not a filter, so it is a link.
// "At risk" is atRisk() (model.js, RISK_DAYS: no hearing and the deadline 7 days away or less) here, in the strip and
// in the weekly memo alike.
export const QUICK = [['riskF', 'At risk', f => f.risk], ['hearF', 'Hearing this week', (f, b) => hearWeek(f, b)], ['poss:monitor', 'Monitoring', (f, b) => b.position === 'monitor']];
// "No hearing yet" is at risk and the rest together: Bills' two groups are "At risk: no hearing yet" and "No hearing yet",
// and the deadline line says "with no hearing yet" (one word per fact, A-14; v6 had three names for it).
const STAND_WORD = { a: 'No hearing yet', b: 'Hearing scheduled', c: 'Through its committees', done: 'At the governor or law', dead: 'Did not advance' };
const FLAG_WORD = { riskF: 'At risk', hearF: 'Hearing this week', tripleF: 'Three or more committees' };
// The filters kept on the Bills screen's own state (the rest live on S, where model.js's facets read them).
const MINE = new Set(['owners', 'cmtes', 'issues', 'spons']);
export const isOn = spec => { const i = spec.indexOf(':'), k = i < 0 ? spec : spec.slice(0, i), raw = i < 0 ? '' : spec.slice(i + 1);
  if (i < 0) return !!S[k];
  if (k === 'stageF') return S.stageF === raw;
  if (k === 'due') return bl().due === raw;
  const set = MINE.has(k) ? bl()[k] : S[k];
  return set.has(k === 'pris' ? Number(raw) : raw); };
export function toggle(spec) {
  const i = spec.indexOf(':'), k = i < 0 ? spec : spec.slice(0, i), raw = i < 0 ? '' : spec.slice(i + 1);
  if (i < 0) S[k] = !S[k];
  else if (k === 'stageF') S.stageF = S.stageF === raw ? '' : raw;
  else if (k === 'due') { const v = bl(); v.due = v.due === raw ? '' : raw; }
  else { const set = MINE.has(k) ? bl()[k] : S[k], v = k === 'pris' ? Number(raw) : raw; set.has(v) ? set.delete(v) : set.add(v); }
  changed();
}
export function clearAll() {
  const v = bl(), scope = v.scope;
  applyFilters({ ...BLANK, scope });   // clearing the filters is not a change of scope: Mine stays Mine
  changed();
}
// Each new filter state starts with sensible folds again (a group opens when it is all there is to see). Any change
// made by hand also means this is no longer the saved view it came from, so the chip stops saying it is.
export function changed(keepView = false) { const v = bl(); if (!keepView) v.view = ''; v.folds = {}; save(); }

// ---- saved views (plan 3.4, Nate 9/19) ----
// A view is a name for a filter state. They live in advocates.prefs, so someone's "My P1s this week" is the same on
// their laptop and their phone; the unnamed current state stays in localStorage, which is per browser on purpose
// (what you were last looking at is not worth syncing). No new Supabase call: DB.patchPrefs already exists.
export const VIEW_CAP = 8;
export const views = () => { const w = S.me?.prefs?.views; return Array.isArray(w) ? w.filter(x => x && x.id && x.name) : []; };
export const curView = () => views().some(w => w.id === bl().view) ? bl().view : '';
export const viewName = id => views().find(w => w.id === id)?.name || '';
const newId = () => 'v' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const putViews = list => DB.patchPrefs({ views: list });
export const addView = async name => { const list = views(); if (list.length >= VIEW_CAP) return null;
  const w = { id: newId(), name, f: viewState() }; await putViews([...list, w]); bl().view = w.id; save(); return w; };
export const renameView = async (id, name) => { await putViews(views().map(w => w.id === id ? { ...w, name } : w)); };
// Delete gives back what it removed and where, so Undo puts it back in the same place in the row.
export const removeView = async id => { const list = views(), at = list.findIndex(w => w.id === id); if (at < 0) return null;
  const w = list[at]; await putViews(list.filter(x => x.id !== id)); if (bl().view === id) { bl().view = ''; save(); } return { w, at }; };
export const restoreView = async ({ w, at }) => { const list = views().slice(); list.splice(Math.min(at, list.length), 0, w); await putViews(list); };
export function applyView(id) {
  const w = views().find(x => x.id === id); if (!w) return false;
  const v = bl(); applyFilters(w.f); v.q = ''; changed(); v.view = id; save(); return true;
}
// A link that opens Bills on one coalition (#/bills?coalition=<id or slug>, from the coalition page, R-022): every one
// of its bills (Team), and nothing else switched on. A one-off: it is not a saved view and is not written over what
// this browser remembers, so a reload comes back to the person's own list. Whatever they change after it is theirs.
export function openCoalition(id) { const v = bl(); applyFilters({ ...BLANK, scope: 'all', camps: [id] }); v.q = ''; v.view = ''; v.folds = {}; }
// Back to how Bills looks on a first visit: your own bills (or your coalitions', for someone who owns none), no
// filters, no search. Columns and row height stay.
export function resetView() { const v = bl(); applyFilters(BLANK); v.scope = defaultScope(); v.q = ''; changed(); }
export const isDefault = () => { const f = viewState(); return !activeFilters().length && f.scope === defaultScope() && !bl().q.trim(); };

// ---- the two sheets: name a view, and look after the ones you have ----
// A real form, so openSheet (never window.prompt, which no phone shows well and no screen reader announces).
const suggestName = () => {
  const on = activeFilters().map(([, l]) => l);
  return (on.length ? on.slice(0, 3).join(' · ') : bl().scope === 'all' ? 'Team bills' : bl().scope === 'coal' ? 'My coalitions’ bills' : 'My bills').slice(0, 40);
};
const nameTaken = (name, notId) => views().some(w => w.id !== notId && w.name.toLowerCase() === name.toLowerCase());
// One name form for both jobs: Save this view, and Rename. `after` redraws whatever opened it.
function nameSheet({ title, value, ok, help, run, after, notId }) {
  openSheet({ title, size: 'auto',
    body: `${help ? `<p class="small muted bl-vhelp">${help}</p>` : ''}
      ${field('bl-vname', 'Name', `<input class="input bl-vinput" id="bl-vname" type="text" maxlength="40" autocomplete="off" enterkeyhint="done" value="${esc(value)}" autofocus>`)}
      <div class="bl-verr" id="bl-verr"></div>`,
    foot: `${btn('Cancel', { kind: 'text', attrs: { 'data-vno': '1' } })}${btn(ok, { attrs: { 'data-vyes': '1' } })}`,
    wire: d => {
      const input = d.querySelector('#bl-vname'), err = d.querySelector('#bl-verr'), go = d.querySelector('[data-vyes]');
      const fail = t => { err.innerHTML = inlineErr('bl-vmsg', t); input.setAttribute('aria-describedby', 'bl-vmsg'); input.focus(); };
      const submit = async () => {
        const name = input.value.trim().replace(/\s+/g, ' ');
        if (!name) return fail('Give the view a name.');
        if (nameTaken(name, notId)) return fail('You already have a view with that name.');
        go.setAttribute('aria-busy', 'true');
        try { await closeSheet({ silent: true }); await run(name); after?.(); }
        catch (e) { go.removeAttribute('aria-busy'); toast(e, { err: true }); }
      };
      go.onclick = submit;
      d.querySelector('[data-vno]').onclick = () => closeSheet();
      input.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } };
      input.oninput = () => { err.innerHTML = ''; input.removeAttribute('aria-describedby'); };
      setTimeout(() => input.select(), 0);
    } });
}
export function openSaveView(after) {
  if (views().length >= VIEW_CAP) {
    toast(`That is ${VIEW_CAP} saved views, as many as we keep. Delete one to make room.`, { action: { label: 'Saved views', run: () => openEditViews(after) } });
    return;
  }
  nameSheet({ title: 'Save this view', ok: 'Save view', value: suggestName(), after,
    help: 'Saves the filters that are on now, under a name. Your saved views follow you to your phone.',
    run: async name => { await addView(name); toast(`Saved “${name}” as a view.`); } });
}
export function openEditViews(after) {
  const list = () => views();
  const bodyHTML = () => list().length
    ? `<ul class="bl-vlist">${list().map(w => `<li class="bl-vrow"><span class="bl-vnm">${esc(w.name)}</span>
        ${iconBtn('pencil', `Rename ${w.name}`, { 'data-vren': w.id })}${iconBtn('trash-2', `Delete ${w.name}`, { 'data-vdel': w.id }, 'bl-vdel')}</li>`).join('')}</ul>
      <p class="small muted bl-vhelp">${list().length} of ${VIEW_CAP} saved.</p>`
    : '<p class="small muted bl-vhelp">No saved views yet. Set your filters, then pick “Save this view”.</p>';
  openSheet({ title: 'Saved views', size: 'auto', body: bodyHTML(),
    wire: d => {
      d.querySelectorAll('[data-vren]').forEach(el => el.onclick = () => { const w = list().find(x => x.id === el.dataset.vren); if (!w) return;
        const was = w.name;
        nameSheet({ title: 'Rename view', ok: 'Save name', value: was, after, notId: w.id,
          run: async name => { await renameView(w.id, name); after?.();
            toast(`Renamed to “${name}”.`, { undo: async () => { await renameView(w.id, was); after?.(); } }); } });
      });
      // A sheet is a modal and the toast lives under the page, so Undo would be out of reach with the sheet still
      // open: deleting closes it. The chips redraw behind, and Undo puts the view back where it was.
      d.querySelectorAll('[data-vdel]').forEach(el => el.onclick = async () => {
        el.setAttribute('aria-busy', 'true');
        try {
          const gone = await removeView(el.dataset.vdel); if (!gone) return;
          await closeSheet({ silent: true }); after?.();
          toast(`Deleted “${gone.w.name}”.`, { undo: async () => { await restoreView(gone); after?.(); } });
        } catch (e) { el.removeAttribute('aria-busy'); toast(e, { err: true }); }
      });
    } });
}
const ownerWord = id => id === 'none' ? 'No owner' : id === S.me?.id ? 'You' : (advocate(id)?.full_name || 'Someone');
// [spec, label] for every filter that is on, in the sheet's order
export function activeFilters() {
  const v = bl(), out = [];
  for (const o of v.owners) out.push([`owners:${o}`, ownerWord(o)]);
  for (const p of S.poss) out.push([`poss:${p}`, posWord(p)]);
  for (const s of S.stands) out.push([`stands:${s}`, STAND_WORD[s] || s]);
  if (S.stageF) out.push([`stageF:${S.stageF}`, stageWords(S.stageF)]);
  for (const k of ['hearF', 'riskF', 'tripleF']) if (S[k]) out.push([k, FLAG_WORD[k]]);
  for (const c of S.camps) out.push([`camps:${c}`, S.campaigns.find(x => x.id === c)?.name || 'Coalition']);
  for (const l of S.lsts) out.push([`lsts:${l}`, (S.lists || []).find(x => x.id === l)?.title || 'List']);
  for (const c of v.cmtes) out.push([`cmtes:${c}`, committeeName(c) || c]);
  for (const i of v.issues) out.push([`issues:${i}`, issueName(i)]);
  for (const n of v.spons) out.push([`spons:${n}`, sponsorName(n)]);
  if (v.due) out.push([`due:${v.due}`, `No hearing yet · by ${dueDay(v.due)}`]);
  return out;
}
export const filterCount = () => activeFilters().length;

// ---- the Filter sheet (V32, F85-F87): one pattern for every list. At the top, the presets (the quick pills v5 had on the
// page, the person's usual list and their saved views), then four groups shown (where it stands, position, owner,
// coalition), and every other filter under "More filters". No option that would show nothing is offered (one that is on
// always shows, so it can be taken off), every option says how many bills it leaves, and the foot says how many show.
// Codes still find what they mean: a committee is listed by its name with its code beside it, and the box above the
// committees takes either ("TRN" or "Transportation"). A half sheet on phones (drag up for more), a popover on a laptop. ----
const opt = (spec, label, n, { ic, title, small } = {}) => { const on = isOn(spec);
  // An option that is on carries a tick (never colour alone). `small`: the Capitol's own name, small after the words.
  return `<button type="button" class="chip bl-opt" data-ft="${esc(spec)}" aria-pressed="${on}"${title ? ` title="${esc(title)}"` : ''}>${on ? icon('check') : ic ? icon(ic) : ''}<span>${esc(label)}${small ? ` <span class="v6-code">${esc(small)}</span>` : ''}</span><span class="bl-n">${n}</span></button>`; };
const shown = (spec, n) => n > 0 || isOn(spec);   // no zero-count options (V32)
// A group whose one choice holds every bill filters nothing (Patti's Owner "Lauren 89" and Coalition "HEAL 89"): it is
// left out, unless that choice is on, so it can come off.
const useful = (items, key, base) => items.length > 1 || items.some(([spec]) => isOn(spec)) || (items[0] && items[0][1] < cnt(base, key, () => true));
// Exact stage in plain words (C-15, A-14): what the bill must do next, the Capitol's name for that deadline small after it;
// "Did not advance", as everywhere in v6, never "Dead".
const STAGE_PLAIN = {
  introduced: ['Just introduced'], first_triple: ['First chamber: clear the first of 3 committees', 'First triple filing'],
  first_lateral: ['First chamber: reach its last committee', 'First lateral'], first_decking: ['First chamber: clear its last committee', 'First decking'],
  first_floor: ['First chamber: floor vote next', 'First floor vote'], first_crossover: ['Crossed to the second chamber', 'Crossover'],
  second_triple: ['Second chamber: clear the first of 3 committees', 'Second triple filing'], second_lateral: ['Second chamber: reach its last committee', 'Second lateral'],
  second_decking: ['Second chamber: clear its last committee', 'Second decking'], second_floor: ['Second chamber: floor vote next', 'Second floor vote'],
  second_crossover: ['Passed both chambers', 'Cross back'], conference: ['In conference'], governor: ['With the governor'], enacted: ['Law'], vetoed: ['Vetoed'],
  ballot: ['To the voters'], dead: ['Did not advance'] };
export const stageWords = k => STAGE_PLAIN[k]?.[0] || STAGES.find(([x]) => x === k)?.[1] || k;
const group = (title, inner, key) => inner ? `<section class="bl-fg" aria-labelledby="bl-fg-${key}"><h3 id="bl-fg-${key}">${title}</h3><div class="chips">${inner}</div></section>` : '';
// The presets: one tap each, pressed while on. "Your usual list" resets everything (scope, filters, search), and shows only
// when something differs from it.
export const PRESETS = [['riskF', 'At risk', 'No hearing yet, and the deadline is a week away or less'], ['hearF', 'Hearing this week', 'A hearing in the next 7 days'], ['poss:monitor', 'Monitoring', 'The bills the team only watches']];
const cmteWords = c => committeeName(c) || S.committees?.[c]?.name || '';
function presetsHTML(base) {
  const list = views(), cur = curView();
  const tests = { riskF: x => x.risk, hearF: (x, b) => hearWeek(x, b), 'poss:monitor': (x, b) => b.position === 'monitor' };
  const chips = PRESETS.map(([spec, label, help]) => { const n = cnt(base, spec.split(':')[0], tests[spec]); return shown(spec, n) ? opt(spec, label, n, { title: help }) : ''; }).join('');
  const usual = isDefault() ? '' : `<button type="button" class="chip bl-opt bl-usual" data-fusual="1">${icon('rotate-ccw')}<span>Your usual list</span></button>`;
  const saved = list.map(w => `<button type="button" class="chip bl-opt bl-saved" data-fview="${esc(w.id)}" aria-pressed="${cur === w.id}">${icon(cur === w.id ? 'bookmark-check' : 'bookmark')}<span>${esc(w.name)}</span></button>`).join('');
  const acts = `<div class="bl-facts">${btn('Save this view', { kind: 'text', sm: true, icon: 'bookmark', attrs: { 'data-fsave': '1' } })}${list.length ? btn(`Saved views (${list.length})`, { kind: 'text', sm: true, icon: 'pencil', attrs: { 'data-fedit': '1' } }) : ''}</div>`;
  return `<section class="bl-fg bl-fpre" aria-labelledby="bl-fg-pre"><h3 id="bl-fg-pre">Quick views</h3><div class="chips">${usual}${chips}${saved}</div>${acts}</section>`;
}
function sheetBody() {
  const v = bl(), base = baseBills(), f = Object.fromEntries(facets().map(g => [g.key, g]));
  const ads = S.advocates.filter(a => a.is_active !== false).sort((a, b) => (b.id === S.me?.id) - (a.id === S.me?.id) || a.full_name.localeCompare(b.full_name));
  // Where it stands, position, owner, coalition: the four everyone uses (shown).
  // Each as [spec, n, label, opts], then drawn only when it can narrow the list (useful).
  const draw = (key, items) => { const on = items.filter(([sp, n]) => shown(sp, n)); return useful(on, key, base) ? on.map(([sp, n, l, o]) => opt(sp, l, n, o)).join('') : ''; };
  const stands = draw('stands', ['b', 'a', 'c', 'done', 'dead'].map(k => [`stands:${k}`, cnt(base, 'stands', (x, b) => standIs(x, b, k)), STAND_WORD[k], k === 'a' ? { title: 'At risk or not: every bill with no hearing yet' } : {}]));
  const posKeys = [...f.poss.opts.map(([k]) => k), 'none'];
  const poss = draw('poss', posKeys.map(k => [`poss:${k}`, cnt(base, 'poss', (x, b) => posIs(b, k)), posWord(k), { ic: POS_ICON[k === 'none' ? '' : k] }]));
  const owners = draw('owners', [...ads.map(a => ({ id: a.id, l: a.id === S.me?.id ? 'You' : a.full_name })), { id: 'none', l: 'No owner' }]
    .map(o => [`owners:${o.id}`, cnt(base, 'owners', (x, b) => ownerHas(b, o.id)), o.l]));
  const camps = draw('camps', S.campaigns.map(c => [`camps:${c.id}`, cnt(base, 'camps', x => x.camps.includes(c.id)), c.name]));
  // More filters: the rest, each with only the options that leave something.
  const hear = [['hearF', 'This week', cnt(base, 'hearF', (x, b) => hearWeek(x, b)), 'A hearing in the next 7 days'], ['riskF', 'At risk: no hearing yet', cnt(base, 'riskF', x => x.risk), 'No hearing, and the deadline is a week away or less']]
    .filter(([s, , n]) => shown(s, n)).map(([s, l, n, t]) => opt(s, l, n, { title: t })).join('');
  const stages = draw('stageF', STAGES.map(([k]) => [`stageF:${k}`, cnt(base, 'stageF', (x, b) => effStage(b) === k), stageWords(k), { title: STAGE_GLOSS[k] || '', small: STAGE_PLAIN[k]?.[1] }]));
  const lists = (S.lists || []).map(l => ({ id: l.id, l: l.title, n: cnt(base, 'lsts', x => x.lsts.includes(l.id)) })).filter(l => shown(`lsts:${l.id}`, l.n)).map(l => opt(`lsts:${l.id}`, l.l, l.n)).join('');
  // Long lists (a committee, an issue, a sponsor each): busiest first, twelve until you type, a box that narrows them.
  const pickRows = (kind, items, on, nameOf, what) => { const all = items.map(([id, n]) => [id, n, on.has(id)]).filter(([, n, o]) => n || o)
      .sort((a, b) => b[2] - a[2] || b[1] - a[1] || nameOf(a[0]).localeCompare(nameOf(b[0]))), many = all.filter(([, , o], i) => o || i < 12).length;
    if (!all.length) return '';
    return `<label class="sr" for="bl-pq-${kind}">Narrow the ${what}</label><input id="bl-pq-${kind}" class="input bl-pq" type="search" data-pq="${kind}" placeholder="Type to narrow ${all.length} ${what}" autocomplete="off">
      <div class="bl-crows" data-pcrows="${kind}">${all.map(([id, n, o], i) => `<button type="button" class="bl-crow" data-ft="${kind}:${esc(id)}" data-pname="${esc(nameOf(id).toLowerCase())} ${esc(String(id).toLowerCase())}" aria-pressed="${o}"${o || i < 12 ? '' : ' hidden'}>${icon(o ? 'square-check-big' : 'square')}<span class="bl-pn">${esc(nameOf(id))}${kind === 'cmtes' ? ` <span class="v6-code">${esc(id)}</span>` : ''}</span><span class="bl-n">${n}</span></button>`).join('')}</div>
      ${all.length > many ? `<p class="small muted bl-pmore" data-pmore="${kind}">${many} of ${all.length} shown. Type to find the rest.</p>` : ''}`; };
  const issIds = new Set(); for (const b of base) for (const i of issuesOf(b)) issIds.add(i); for (const i of v.issues) issIds.add(i);
  const issRows = pickRows('issues', [...issIds].map(i => [i, cnt(base, 'issues', (x, b) => issuesOf(b).includes(i))]), v.issues, issueName, 'issues');
  const spIds = new Set(); for (const b of base) for (const n of sponsOf(b)) spIds.add(n); for (const n of v.spons) spIds.add(n);
  const spRows = pickRows('spons', [...spIds].map(n => [n, cnt(base, 'spons', (x, b) => sponsOf(b).includes(n))]), v.spons, sponsorName, 'sponsors');
  const seen = new Set(); for (const b of base) for (const c of cmtesOf(b)) seen.add(c); for (const c of v.cmtes) seen.add(c);
  const cmRows = pickRows('cmtes', [...seen].map(c => [c, cnt(base, 'cmtes', (x, b) => cmtesOf(b).includes(c))]), v.cmtes, c => cmteWords(c) || c, 'committees');
  const trip = shown('tripleF', cnt(base, 'tripleF', x => x.triple)) ? `<div class="chips bl-trip">${opt('tripleF', 'Three or more committees', cnt(base, 'tripleF', x => x.triple), { title: 'Sent to three committees in one chamber: it must clear its first by the triple filing deadline' })}</div>` : '';
  const moreOn = ['hearF', 'riskF', 'tripleF'].filter(k => S[k] && !PRESETS.some(([p]) => p === k)).length + (S.stageF ? 1 : 0) + S.lsts.size + v.issues.size + v.spons.size + v.cmtes.size;
  const open = v.fopen.has('more') || moreOn > 0;
  const more = [group('Hearing', hear, 'hear'), stages ? group('Exact stage', stages, 'stage') : '', lists ? group('List on the public page', lists, 'list') : '',
    issRows ? `<section class="bl-fg" aria-labelledby="bl-fg-iss"><h3 id="bl-fg-iss">Issue</h3>${issRows}</section>` : '',
    trip || cmRows ? `<section class="bl-fg" aria-labelledby="bl-fg-cm"><h3 id="bl-fg-cm">Committee</h3>${trip}${cmRows}</section>` : '',
    spRows ? `<section class="bl-fg" aria-labelledby="bl-fg-sp"><h3 id="bl-fg-sp">Sponsor</h3>${spRows}</section>` : ''].join('');
  return `<div class="bl-fs">
    ${presetsHTML(base)}
    ${group('Where it stands', stands, 'st')}
    ${group('Position', poss, 'pos')}
    ${group('Owner', owners, 'own')}
    ${group('Coalition', camps, 'camp')}
    ${more ? `<details class="bl-fold bl-fmore" data-fkey="more"${open ? ' open' : ''}><summary><h3>More filters</h3><span class="bl-fsub">${moreOn ? `${moreOn} on` : 'Hearing, stage, list, issue, committee, sponsor'}</span>${icon('chevron-down', { cls: 'chev' })}</summary><div class="bl-fin">${more}</div></details>` : ''}
    <p class="bl-fhow">Inside a group, a bill needs any one choice. Across groups, it needs all of them.</p>
  </div>`;
}
const footHTML = () => { const n = shownBills().length, any = filterCount();
  return `${btn('Clear all', { kind: 'text', cls: 'bl-fclear', attrs: { 'data-fclear': '1', disabled: !any } })}${btn(`Show ${n} bill${n === 1 ? '' : 's'}`, { attrs: { 'data-fdone': '1' } })}`; };

// openFilters(anchor, { focus }): `focus: 'save'` lands on Save this view (More tools › Saved views, with none saved yet).
export function openFilters(anchor, { focus = '' } = {}) {
  const wide = wideNow();
  let d = null;
  const paint = keepSel => {
    freshFacts();
    const body = d.querySelector('.sv-sh-body'), y = body.scrollTop;
    body.innerHTML = sheetBody(); body.scrollTop = y;
    d.querySelector('.sv-sh-foot').innerHTML = footHTML();
    wireSheet();
    if (keepSel) d.querySelector(keepSel)?.focus({ preventScroll: true });
  };
  const wireSheet = () => {
    d.querySelectorAll('[data-ft]').forEach(el => el.onclick = () => { toggle(el.dataset.ft); hooks.render(); paint(`[data-ft="${CSS.escape(el.dataset.ft)}"]`); });
    d.querySelector('[data-fusual]')?.addEventListener('click', () => { resetView(); hooks.render(); paint('[data-fdone]'); });
    d.querySelectorAll('[data-fview]').forEach(el => el.onclick = () => { const id = el.dataset.fview; if (curView() === id) { resetView(); } else applyView(id); hooks.render(); paint(`[data-fview="${CSS.escape(id)}"]`); });
    d.querySelector('[data-fsave]')?.addEventListener('click', async () => { await closeSheet({ silent: true }); openSaveView(() => hooks.render()); });
    d.querySelector('[data-fedit]')?.addEventListener('click', async () => { await closeSheet({ silent: true }); openEditViews(() => hooks.render()); });
    // The narrowing boxes work on the rows already drawn (no repaint, so the keyboard stays where it is).
    d.querySelectorAll('[data-pq]').forEach(inp => inp.oninput = () => { const q = plain(inp.value.trim()), rows = [...d.querySelectorAll(`[data-pcrows="${inp.dataset.pq}"] .bl-crow`)];
      let k = 0; rows.forEach(r => { const hit = q ? plain(r.dataset.pname).includes(q) : (r.getAttribute('aria-pressed') === 'true' || k < 12); if (hit) k++; r.hidden = !hit; });
      d.querySelector(`[data-pmore="${inp.dataset.pq}"]`)?.toggleAttribute('hidden', !!q); });
    d.querySelectorAll('details[data-fkey]').forEach(el => el.ontoggle = () => { const s = bl().fopen; el.open ? s.add(el.dataset.fkey) : s.delete(el.dataset.fkey); });
    d.querySelector('[data-fclear]').onclick = () => { clearAll(); hooks.render(); paint(); };
    d.querySelector('[data-fdone]').onclick = () => closeSheet();
  };
  freshFacts();
  d = openSheet({ title: 'Filter bills', size: wide ? 'auto bl-pop' : 'half bl-fsheet', body: sheetBody(), foot: footHTML(),
    wire: dlg => { d = dlg; wireSheet(); if (wide) placePop(dlg, anchor); else dragToGrow(dlg);
      if (focus === 'save') setTimeout(() => dlg.querySelector('[data-fsave]')?.focus(), 30); } });
  return d;
}
// Desktop: the sheet sits under the button that opened it, like a popover, and keeps the page visible beside it.
export function placePop(d, anchor) {
  if (!anchor || !anchor.isConnected) return;
  const r = anchor.getBoundingClientRect(), w = Math.min(400, innerWidth - 32);
  const left = Math.max(16, Math.min(r.right - w, innerWidth - w - 16)), top = Math.round(r.bottom + 8);
  Object.assign(d.style, { left: left + 'px', top: top + 'px', width: w + 'px', maxHeight: `calc(100vh - ${top + 16}px)` });
}
// Phone: the sheet opens at about two thirds of the screen; drag the handle up for the full height, down to close.
export function dragToGrow(d) {
  const head = d.querySelector('.sv-sh-head'), grab = d.querySelector('.sv-sh-grab');
  let y0 = null, dragged = false;
  const down = e => { if (e.target.closest('button')) return; y0 = e.clientY; try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* old browser: the lift still counts where it lands */ } };
  const up = e => { if (y0 == null) return; const dy = e.clientY - y0; y0 = null; dragged = Math.abs(dy) > 10;
    if (dy < -24) d.classList.add('bl-tall'); else if (dy > 80) { if (d.classList.contains('bl-tall')) d.classList.remove('bl-tall'); else closeSheet(); } };
  // A drag that ends off the sheet makes a click on the backdrop, which would close it: that click is not a tap.
  d.addEventListener('click', e => { if (dragged) { dragged = false; e.stopImmediatePropagation(); } }, true);
  [head, grab].forEach(el => { if (!el) return; el.addEventListener('pointerdown', down); el.addEventListener('pointerup', up); el.style.touchAction = 'none'; });
  grab?.addEventListener('click', () => d.classList.toggle('bl-tall'));
}
