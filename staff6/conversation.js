// HIPHI Staff v3 · conversations with legislators (R-022 wave 2 #9, migration 064). A person comes here to record what a
// legislator said, so that the next person finds it (B-1). Nate, 9/21: "A conversation with a legislator is more of an
// issue conversation than a bill specific conversation." So a conversation is filed under an issue (and under the bill
// it was logged from, when there was one), and one meeting with several legislators is one row per legislator sharing a
// conversation_id. It shows on each legislator's page, on the issue's page and on every bill of that issue (their
// Activity tab): one record found in three places, where notes used to live in three places that never met.
// The same dialog and the same list serve all three pages. Your own entry can be corrected or deleted for ten minutes
// (the database enforces the ten minutes for a correction); after that it is the record, and only an admin can delete it.
// R-335 (practice copy, profile.js PROFILES): "Add a note" saves a dated note about one legislator in the same log (no issue,
// bill or other legislators), and your own entries can be corrected at any time, each correction keeping the wording
// before it ("edited", Earlier wording). Delete keeps its ten minutes. With PROFILES off all of this is as it was.
// Staff v6 (R-336 V07, V23, V24; F146, F147): one name for the act everywhere, "Log a talk" (v5 had 5 buttons with 3 names).
// "Filed under" offers the bill's issue and "Only this bill" (or, from a legislator's page, only their page), and finds any
// other issue by a search, their committees' issues first: 2 choices and a search instead of a list of 92 (V23). From a
// bill waiting for a hearing, "This was an ask for a hearing" saves the talk with the chair as the ask, with its answer and
// committee (migration 183), the same record as "Did you send it?"; a talk without the tick is never an ask (V24).
// logConversation({ ask: true }) opens with the tick on (HEARINGS' "I asked another way", F138).
import { S, DB, DEMO, esc, fmtDate, advocate, hooks } from './data.js';
import { legById, billById, stopOf, legsOf, cmteName, hiToday, hstDayOf, diedish, chairIdsOf, plain } from './model.js';
import { askWords, committeeName, sayWords as billSay } from './steps.js';
import { plainCodes } from './terms.js';   // an ask's app-written words name the committee, not its code (D15)   // a bill named without its draft code (D15)
import { icon, btn, iconBtn, chip, toast, openSheet, closeSheet, menuSheet } from './ui.js';
import { showAllBtn } from './ui.js';   // R-277 fix 4 (U-4): one "Show all" on every screen
import { issuesOfBill, issueById } from './issues.js';
import { photo, shortName, partyDist, legHref, roleWord, seatsText } from './pathway.js';
import { matchLegs } from './legislators.js';
import { billRoute } from './model.js';
import { drafts } from './bill.js';   // R-277 fix 8: the same held words the bill chat and the to-do box keep
import { PROFILES, earlierSheet } from './profile.js';   // R-335 (practice copy)

// R-277 fix 8 (E-5): words typed about a meeting are never lost. Esc, a tap outside the sheet or a phone's back swipe
// closed it and the note was gone. Like the bill chat's draft (activity.js, bill.js drafts), what is typed is held as it
// is typed, per place it was opened from (a bill, an issue, a legislator), and comes back when the sheet opens there
// again; this tab also keeps it across a reload (sessionStorage: it goes when the tab closes, so a note about a meeting
// does not linger on a shared computer). Saving the conversation lets it go.
const CV_STORE = 'sv_cvnotes';
const cvStore = () => { try { return JSON.parse(sessionStorage.getItem(CV_STORE) || '{}') || {}; } catch { return {}; } };
const heldNote = k => drafts.get(k) ?? cvStore()[k] ?? null;
function holdNote(k, v) {
  if (v && (v.text || '').trim()) drafts.set(k, v); else drafts.delete(k);
  try { const all = cvStore(); if (drafts.has(k)) all[k] = v; else delete all[k]; sessionStorage.setItem(CV_STORE, JSON.stringify(all)); } catch { /* private window: this visit only */ }
}

const WINDOW = 10 * 60e3;
const LATE = 'This talk can no longer be changed: a talk can be corrected for ten minutes after it is saved.';
const firstName = a => String(a?.full_name || '').split(' ')[0] || 'Someone';
const andList = xs => xs.length <= 1 ? (xs[0] || '') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;
const dayOf = d => fmtDate(d, { weekday: 'short' }).replace(/^(\w{3}),/, '$1');
const liveIssues = () => (S.issues || []).filter(i => !i.archived_at);
const hover = () => { try { return matchMedia('(hover: hover) and (pointer: fine)').matches; } catch { return false; } };
// A menu closes itself with history.back(); a sheet opened before that Back lands would have its entry undone by it.
const afterBack = fn => { if (!history.state?.sheet) { fn(); return; } let done = false; const run = () => { if (done) return; done = true; removeEventListener('popstate', run); fn(); }; addEventListener('popstate', run); setTimeout(run, 500); };
const uuid = () => {
  try { if (crypto.randomUUID) return crypto.randomUUID(); } catch { /* an insecure origin: build one below */ }
  const b = crypto.getRandomValues(new Uint8Array(16)); b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
  const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
};

// ---- rows -> conversations ----
// One per conversation_id; a note from before 064 has none and is a conversation of its own. Newest day first.
export function groupsOf(rows) {
  const by = new Map();
  for (const r of rows || []) {
    const k = r.conversation_id ? 'c:' + r.conversation_id : 'n:' + r.id;
    if (!by.has(k)) by.set(k, []);
    if (!by.get(k).some(x => String(x.id) === String(r.id))) by.get(k).push(r);
  }
  return [...by].map(([key, rs]) => {
    const r = rs[0], at = rs.map(x => String(x.created_at || '')).sort()[0];
    return { key, rows: rs, id: r.conversation_id || null, body: r.body || '', issue_id: r.issue_id || null, bill_id: r.bill_id || null,
      day: r.met_on || hstDayOf(at || Date.now()), created_at: at, advocate_id: r.advocate_id, legs: [...new Set(rs.map(x => x.legislator_id))],
      kind: r.kind || null, history: r.history || [], edited_at: r.edited_at || null, edited_by: r.edited_by || null,   // R-335: a note, and earlier wording
      answer: rs.find(x => x.answer)?.answer || null };   // a chair ask (183): its words are the app's own
  }).sort((a, b) => b.day.localeCompare(a.day) || String(b.created_at).localeCompare(String(a.created_at)));
}
const hiddenNow = () => (S.cvHidden ??= new Set());
export const convCount = rows => groupsOf(rows).filter(g => !hiddenNow().has(g.key)).length;
const fresh = g => Date.now() - new Date(g.created_at).getTime() < WINDOW;
const mine = g => !!S.me && g.advocate_id === S.me.id;
// R-335 (practice copy): your own entry can be corrected at any time, so its "…" stays; with PROFILES off, ten minutes.
const mayFix = g => mine(g) && (PROFILES() || fresh(g));
const canTouch = g => mayFix(g) || !!S.me?.is_admin;
const isNote = g => g.kind === 'note';

// A legislator's page holds only that legislator's rows; the others in the same conversation are named from the rows
// the app already has (the sandbox has them all) and, live, from DB.conversationRows when the data layer offers it.
function heldRows() {
  const m = new Map();
  for (const r of [...(S.demoNotes || []), ...Object.values(S.legNotes || {}).flat(), ...Object.values(S.convCache || {}).flat(), ...(S.cvExtra || [])]) if (r) m.set(String(r.id), r);
  return [...m.values()];
}
export function withOthers(rows) {
  const ids = new Set((rows || []).map(r => r.conversation_id).filter(Boolean));
  if (!ids.size) return rows || [];
  const seen = new Set(rows.map(r => String(r.id)));
  return [...rows, ...heldRows().filter(r => r.conversation_id && ids.has(r.conversation_id) && !seen.has(String(r.id)))];
}
const askedFor = new Set();
export function fetchOthers(rows, then) {
  if (DEMO || typeof DB.conversationRows !== 'function') return;
  const ids = [...new Set((rows || []).map(r => r.conversation_id).filter(Boolean))].filter(id => !askedFor.has(id));
  if (!ids.length) return;
  ids.forEach(id => askedFor.add(id));
  DB.conversationRows(ids).then(extra => { if ((extra || []).length) { S.cvExtra = [...(S.cvExtra || []), ...extra]; then(); } }).catch(() => {});
}

// ---- landing on one conversation (R-316 H-15) ----
// A search result opens the place the conversation lives with ?cv=<its key>: that list shows whole, and the card comes
// into view, takes the focus and stays marked, once per arrival (a repaint does not scroll the page back to it).
const landKey = () => { try { return new URLSearchParams(location.hash.split('?')[1] || '').get('cv'); } catch { return null; } };
let landed = '';
addEventListener('hashchange', () => { if (!landKey()) landed = ''; });   // leaving it: the next arrival lands again
function land(box) {
  const k = landKey(); if (!k || landed === location.hash) return;
  const el = [...box.querySelectorAll('[data-cvkey]')].find(x => x.dataset.cvkey === k); if (!el) return;
  landed = location.hash;
  setTimeout(() => { if (!el.isConnected) return; el.scrollIntoView({ block: 'center' }); el.focus({ preventScroll: true }); }, 60);
}

// ---- the list ----
// here: the page's own context, so the page never repeats itself (A-14): a legislator's page does not name them on every
// row, an issue's page does not put its own issue on every row, a bill's page names another bill only when it is another
// and its issue only when the bill has more than one (here.issueIds), which is when the chip tells the rows apart.
function itemHTML(g, here) {
  const legs = g.legs.map(legById).filter(Boolean);
  const names = legs.filter(l => l.id !== here.legId).map(l => `<a href="${esc(legHref(l))}">${esc(shortName(l))}</a>`);
  const who = advocate(g.advocate_id);
  const quiet = g.issue_id === here.issueId || (here.issueIds?.length === 1 && here.issueIds[0] === g.issue_id);
  const iss = g.issue_id && !quiet ? issueById(g.issue_id) : null;
  const bill = g.bill_id && g.bill_id !== here.billId ? billById(g.bill_id) : null;
  const head = here.legId ? (names.length ? `Also with ${andList(names)}` : '') : (andList(names) || 'A legislator');
  // R-335: a note says it is one ("Note · Kris"), and a corrected entry says "edited", which opens its earlier wording.
  const ed = PROFILES() && g.edited_at ? `<button type="button" class="linkbtn cv-ed" data-cved="${esc(g.key)}" aria-label="Edited. See the earlier wording">edited</button>` : '';
  const meta = [esc(dayOf(g.day)), isNote(g) ? `Note · ${mine(g) ? 'You' : esc(firstName(who))}` : mine(g) ? 'you logged it' : `${esc(firstName(who))} logged it`,
    bill ? `on <a href="${billRoute(bill)}">${bill.nickname ? `${esc(bill.nickname)} <span class="bn-num">${esc(bill.bill_number)}</span>` : esc(bill.bill_number)}</a>` : '', ed].filter(Boolean).join(' · ');
  const at = landKey() === g.key;   // R-316 H-15: the one a search result opened
  return `<article class="row cv-item${at ? ' cv-land' : ''}" data-cvkey="${esc(g.key)}"${at ? ' tabindex="-1"' : ''}>
    <div class="cv-main">
      ${head ? `<p class="cv-names">${head}</p>` : ''}
      <p class="cv-meta"><span>${meta}</span>${iss ? chip(iss.name, '', 'tag', { sm: true }) : ''}</p>
      <p class="cv-text">${g.answer ? plainCodes(esc(g.body)) : esc(g.body)}</p>
    </div>
    ${canTouch(g) ? iconBtn('ellipsis', isNote(g) ? 'More for this note' : 'More for this talk', { 'data-cvmore': g.key }, 'cv-more') : ''}
  </article>`;
}
export function convListHTML(rows, here = {}, { limit = 3, key = 'cv', none = 'No talks logged yet.' } = {}) {
  const gs = groupsOf(rows).filter(g => !hiddenNow().has(g.key));
  if (!gs.length) return `<p class="cv-none">${none}</p>`;
  const lk = landKey(), all = !limit || (S.cvAll ??= new Set()).has(key) || gs.length <= limit + 1 || (lk && gs.some(g => g.key === lk));
  const shown = all ? gs : gs.slice(0, limit);
  return `<div class="rows cv-list">${shown.map(g => itemHTML(g, here)).join('')}</div>
    ${shown.length < gs.length ? showAllBtn(gs.length, { 'data-cvall': key }, { cls: 'cv-all' }) : ''}`;
}
// rows(): the rows as they are now; redraw(): paint the list again (a whole page, or just this box).
export function wireConvList(box, { rows, redraw }) {
  if (!box) return;
  land(box);
  box.querySelectorAll('[data-cvall]').forEach(el => el.onclick = () => { (S.cvAll ??= new Set()).add(el.dataset.cvall); redraw(); });
  box.querySelectorAll('[data-cvmore]').forEach(el => el.onclick = () => { const g = groupsOf(rows()).find(x => x.key === el.dataset.cvmore); if (g) convMenu(g, redraw); });
  box.querySelectorAll('[data-cved]').forEach(el => el.onclick = () => { const g = groupsOf(rows()).find(x => x.key === el.dataset.cved); if (g) earlierOf(g); });
}
function convMenu(g, redraw) {
  const ok = fresh(g), admin = !!S.me?.is_admin, any = PROFILES();
  const late = 'A talk can be corrected for ten minutes after it is saved. After that it is the record.';
  const edit = () => afterBack(() => isNote(g) ? addNote({ edit: g, onDone: redraw }) : logConversation({ edit: g, onDone: redraw }));
  menuSheet({ title: isNote(g) ? 'Note' : 'Talk', items: [
    mine(g) ? { label: 'Edit', icon: 'pencil', sub: any ? 'Any time. The earlier wording is kept' : 'For ten minutes after it is saved', disabled: !ok && !any, reason: late, run: edit } : null,
    any && g.history.length ? { label: 'Earlier wording', icon: 'history', run: () => afterBack(() => earlierOf(g)) } : null,
    mine(g) || admin ? { label: 'Delete', icon: 'trash-2', danger: true, disabled: !ok && !admin, reason: any ? 'Your own can be deleted for ten minutes after it is saved. After that only an admin can.' : late, run: () => removeConv(g, redraw) } : null,
  ] });
}
// R-335: the words now, then each version before, with who wrote it and when (profile.js draws it, as for a profile line).
function earlierOf(g) {
  earlierSheet({ now: { body: g.body, by: g.edited_by || g.advocate_id, at: g.edited_at || g.created_at }, versions: g.history,
    about: `${isNote(g) ? 'Note' : 'Talk'} · ${dayOf(g.day)}` });
}
// Delete acts at once and offers Undo; the rows go for good only once the Undo has gone (B-5), as the legislator page did.
function removeConv(g, redraw) {
  hiddenNow().add(g.key); redraw();
  const t = setTimeout(async () => {
    try { for (const r of g.rows) await DB.delLegNote(r.id, r.legislator_id); }
    catch { toast(`Could not delete the ${isNote(g) ? 'note' : 'talk'}. It is back.`, { err: true }); }
    hiddenNow().delete(g.key); redraw();
  }, 10000);
  toast(isNote(g) ? 'Note deleted.' : 'Talk deleted.', { undo: () => { clearTimeout(t); hiddenNow().delete(g.key); redraw(); } });
}

// ---- a Conversations section that loads its own rows (a bill's Activity tab, an issue's page) ----
// q: { billId, issueIds } for DB.conversations. The first paint uses what the data layer already holds, so coming back
// to a tab does not flash a loading line; the query then answers and the list is painted again.
const mounted = new Map();   // section id -> refresh()
const qKey = q => (q.billId || '') + '|' + [...(q.issueIds || [])].sort().join(',');
const sigOf = (rows, key) => rows.map(r => [r.id, r.body, r.issue_id, r.met_on, r.legislator_id].join('~')).join('|') + '#' + [...hiddenNow()].join(',') + '#' + !!S.cvAll?.has(key);
const HEAD = {
  bw: (id, title, n, act) => `<section class="bw-sec cv-sec" data-cvsec="${id}" aria-labelledby="${id}-h"><div class="bw-sech"><h2 id="${id}-h">${title}${n}</h2>${act}</div>`,
  le: (id, title, n, act) => `<section class="le-sec cv-sec" data-cvsec="${id}" aria-labelledby="${id}-h"><div class="le-sechead"><h2 id="${id}-h">${title}${n}</h2>${act}</div>`,
};
// v3 options, for a bill's Activity (R-264): act: false leaves out the section's own "Log a conversation" (the tab's one
// Log button asks what happened), count: false leaves out the number beside the heading (numbers only where they ask for
// action), and hideEmpty: true keeps the whole section hidden until there is a conversation to show.
export function convSectionHTML({ id, q, here = {}, title = 'Talks with legislators', kind = 'bw', limit = 3, none, act: withAct = true, count = true, hideEmpty = false }) {
  const rows = S.convCache?.[qKey(q)] || null, n = rows ? convCount(rows) : 0;
  const act = withAct ? btn('Log a talk', { kind: 'text', icon: 'message-square-plus', attrs: { 'data-cvlog': id, 'aria-haspopup': 'dialog' } }) : '';
  const html = `${HEAD[kind](id, title, count ? ` <span class="cv-n" data-cvn${n ? '' : ' hidden'}>${n || ''}</span>` : '', act)}
    <div class="cv-box" data-cvbox>${rows ? convListHTML(rows, here, { limit, key: id, none }) : `<p class="cv-none cv-wait">${icon('loader-circle')}Loading the talks…</p>`}</div>
  </section>`;
  // Hidden while loading too, so an empty list never flashes "Loading" and then disappears.
  return hideEmpty && !n ? html.replace(/^<section /, '<section hidden ') : html;
}
// log: what the dialog opens with ({ bill } or { issueId }).
export function wireConvSection(root, { id, q, here = {}, limit = 3, none, log = {}, hideEmpty = false }) {
  const sec = root.querySelector(`[data-cvsec="${id}"]`); if (!sec) return;
  const box = sec.querySelector('[data-cvbox]'), n = sec.querySelector('[data-cvn]');
  let rows = S.convCache?.[qKey(q)] || null, drawn = rows ? sigOf(rows, id) : '';
  const paint = () => {
    if (!box.isConnected) return;
    drawn = sigOf(rows || [], id);
    box.innerHTML = convListHTML(rows || [], here, { limit, key: id, none });
    const c = convCount(rows || []); if (n) { n.textContent = c || ''; n.hidden = !c; }
    if (hideEmpty) sec.hidden = !c;
    wireConvList(box, { rows: () => rows || [], redraw: refresh });
  };
  // Painted again only when something changed, so a focused button or a half-read list is not swapped out from under you.
  // A hidden section whose list is still empty stays as it is; one that failed to load says so (B-7).
  const refresh = () => DB.conversations(q).then(r => { rows = r || []; if (sigOf(rows, id) !== drawn) paint(); })
    .catch(() => { if (box.isConnected && !rows) { box.innerHTML = '<p class="cv-none">The talks did not load. Try again in a moment.</p>'; sec.hidden = false; } });
  mounted.set(id, refresh);
  sec.querySelector('[data-cvlog]')?.addEventListener('click', () => logConversation({ ...log, onDone: refreshConversations }));
  if (rows) wireConvList(box, { rows: () => rows || [], redraw: refresh });
  refresh();
}
// Every section on screen reads again (after a conversation is logged from somewhere else on the page).
export function refreshConversations() { for (const [id, f] of mounted) { if (document.querySelector(`[data-cvsec="${id}"]`)) f(); else mounted.delete(id); } }

// ---- who was there: suggestions and a search ----
// From a bill: the members of the committee holding it now, chair first ("that bill's current committee members
// first"). From an issue: the committees holding its live bills. Anyone else is a search away (name, district, committee).
function suggestFor({ bill = null, issueId = null } = {}) {
  const bills = bill ? [bill] : issueId ? (S.billIssues || []).filter(x => x.issue_id === issueId).map(x => billById(x.bill_id)).filter(b => b && !diedish(b)) : [];
  const out = new Map(), codes = [];
  for (const b of bills) { const c = stopOf(b).committee; if (c && !codes.includes(c)) codes.push(c); }
  for (const c of codes) for (const m of legsOf(c)) if (!out.has(m.l.id)) out.set(m.l.id, { l: m.l, role: m.role, sub: `${roleWord(m.role)}, ${m.committee}`, rank: { chair: 0, vice_chair: 1, member: 2 }[m.role] ?? 2 });
  const list = [...out.values()].sort((a, b) => a.rank - b.rank);
  const label = !list.length ? '' : bill || codes.length === 1 ? `On ${committeeName(codes[0]) || cmteName(codes[0])}` : 'On the committees holding its bills';
  return { label, list };
}
function sgHTML(picked, q, sugg) {
  const t = q.trim();
  if (!t) {
    const list = sugg.list.filter(x => !picked.includes(x.l.id)).slice(0, 7);
    if (!list.length) return '';
    return `${sugg.label ? `<p class="cv-sgh">${esc(sugg.label)}</p>` : ''}<div class="chips cv-sgc">${list.map(x =>
      `<button type="button" class="chip" data-cvadd="${x.l.id}" aria-label="${esc(`Add ${shortName(x.l)}, ${x.sub}`)}">${icon('plus')}${esc(shortName(x.l))}${x.rank < 2 ? `<span class="cv-role">${esc(roleWord(x.role).toLowerCase())}</span>` : ''}</button>`).join('')}</div>`;
  }
  const list = matchLegs(t).filter(l => !picked.includes(l.id)).slice(0, 6);
  if (!list.length) return `<p class="cv-sgnone">No legislator matches “${esc(t)}”. Try a last name, a district (SD 12) or a committee code.</p>`;
  return `<div class="sv-pickl cv-sgl">${list.map(l =>
    `<button type="button" data-cvadd="${l.id}">${photo(l, 32)}<span class="body"><span class="title">${esc(shortName(l))}</span><span class="sub">${esc([partyDist(l), seatsText(l)].filter(Boolean).join(' · '))}</span></span>${icon('plus', { cls: 'cv-plus' })}</button>`).join('')}</div>`;
}
const pickedHTML = ids => ids.map(id => { const l = legById(id); return l ? `<button type="button" class="chip cv-pk" data-cvrm="${l.id}" aria-label="${esc(`Remove ${shortName(l)}`)}">${esc(shortName(l))}${icon('x')}</button>` : ''; }).join('');

// ---- Filed under: an issue, or one bill ----
// Two choices and a search (V23; v5 listed all 92 issues): the bill's own issue (the default; a bill on two issues shows
// both) and "Only HB 1562" (Nate: "allow just this bill when it has none"); from a legislator's page, "Only Rep. Kila's
// page"; from an issue's page, that issue. Any other issue is found by its name, the issues of the bills in the
// legislators' committees first.
// Each issue says it is one and names its bills, "Issue: Youth mental health app pilot (HB1562, SB2679)": 55 of the 91
// issues share a bill's nickname, so a bare name read as the bill (R-022 review, 9/21).
function nearIssues(legIds) {
  const seats = new Set((S.committeeMembers || []).filter(m => legIds.includes(m.legislator_id)).map(m => m.committee)), out = new Map();
  if (!seats.size) return [];
  for (const b of S.bills) {
    if (b.tracked === false || !b.position || b.position === 'monitor' || diedish(b)) continue;
    const c = stopOf(b).committee; if (!c || !String(c).split('/').some(x => seats.has(x.trim()))) continue;
    for (const i of issuesOfBill(b.id)) out.set(i.id, i);
  }
  return [...out.values()].sort((a, b) => a.name.localeCompare(b.name));
}
// An issue's bills as numbers, the bill you are on first: where a talk filed under it shows.
const numsOf = (issueId, ctx) => {
  const bs = (S.billIssues || []).filter(x => x.issue_id === issueId).map(x => billById(x.bill_id)).filter(Boolean);
  if (ctx && !bs.some(x => x.id === ctx.id)) bs.push(ctx);   // filed from a bill that is not on it: it shows there too
  return [...new Set(bs.sort((a, b) => (b.id === ctx?.id) - (a.id === ctx?.id) || a.bill_number.localeCompare(b.bill_number, 'en', { numeric: true })).map(x => x.bill_number))];
};
const issueNums = (i, ctx) => { const n = numsOf(i.id, ctx); return n.length ? `${n.slice(0, 3).join(', ')}${n.length > 3 ? `, +${n.length - 3}` : ''}` : ''; };
const issueLabel = (i, ctx) => { const n = issueNums(i, ctx); return `Issue: ${i.name}${n ? ` (${n})` : ''}`; };
// The two default choices, as [value, label]: the bill's issues and "Only this bill", or the page's own issue and "Only
// the legislator's page".
function aboutDefaults(ctx, issueId, picked) {
  const own = ctx ? issuesOfBill(ctx.id) : issueId ? [issueById(issueId)].filter(Boolean) : [];
  const only = ctx ? `Only ${billSay(ctx)}` : picked.length === 1 && legById(picked[0]) ? `Only ${shortName(legById(picked[0]))}’s page` : picked.length > 1 ? 'Only the legislators’ pages' : 'Only the legislator’s page';
  return [...own.map(i => ['i:' + i.id, issueLabel(i, ctx)]), ['', only]];
}
const radioHTML = (opts, v) => opts.map(([val, label]) => `<label class="cv-opt"><input type="radio" name="cv-about" value="${esc(val)}"${val === v ? ' checked' : ''}><span>${esc(label)}</span></label>`).join('');
// The issues that match what is typed (or, before anything is typed, the legislators' committees' issues), up to 6.
function issueHits(q, ctx, picked, shown) {
  const t = plain(q.trim()), near = nearIssues(picked), nearIds = new Set(near.map(i => i.id));
  const pool = t ? liveIssues().filter(i => plain(i.name).includes(t)) : near;
  return pool.filter(i => !shown.has('i:' + i.id)).sort((a, b) => nearIds.has(b.id) - nearIds.has(a.id) || a.name.localeCompare(b.name)).slice(0, 6);
}
// Where it will show, in bill numbers: "Team only. Shows on each legislator's page and on HB1562 and SB2679."
function reachLine(ctx, v) {
  const nums = v.startsWith('i:') ? numsOf(v.slice(2), ctx) : ctx ? [ctx.bill_number] : [];
  const bills = nums.length > 4 ? `${nums.slice(0, 3).join(', ')} and ${nums.length - 3} more bills` : andList(nums);
  return `Team only. Shows on each legislator’s page${bills ? ` and on ${bills}` : ''}.`;
}
// A bill waiting for a hearing: its committee and its chairs, for "This was an ask for a hearing" (V24).
function askOf(ctx) {
  const a = ctx ? askWords(ctx) : null; if (!a || a.key === 'scheduled') return null;
  const ids = chairIdsOf(a.code); return ids.length ? { code: a.code, ids, decide: !!a.decide } : null;
}

// ---- the dialog: log one, or correct your own ----
// edit: a talk from groupsOf(). text: words already typed elsewhere (Log activity > Meeting hands them over). ask: the
// tick "This was an ask for a hearing" starts on (HEARINGS' "I asked another way", F138).
export function logConversation({ bill = null, issueId = null, legislatorIds = [], text = '', edit = null, ask = false, onDone = () => hooks.render() } = {}) {
  const g = edit, ctx = g ? (g.bill_id ? billById(g.bill_id) || null : null) : bill;
  let picked = g ? [...g.legs] : [...new Set((legislatorIds || []).map(Number))].filter(id => legById(id));
  let q = '';
  const first = g ? g.issue_id : issueId || (ctx ? issuesOfBill(ctx.id)[0]?.id : null) || null;
  const sugg = suggestFor({ bill: ctx, issueId: ctx ? null : first });
  // The held note for this place (not for an edit, whose words are the saved ones until saved again).
  const nk = g ? null : `cv:${ctx?.id || ''}:${issueId || ''}:${[...picked].sort().join(',')}`, held = nk && !text ? heldNote(nk) : null;
  if (held?.picked?.length) picked = [...new Set([...picked, ...held.picked.map(Number)])].filter(id => legById(id));
  const desk = hover(), v0 = first ? 'i:' + first : '';
  const asking = g ? null : askOf(ctx);
  // The choices: the two defaults, plus an issue an edit was filed under (an archived one too, so an edit does not lose it).
  let extra = null;
  const defaults = () => aboutDefaults(ctx, issueId, picked);
  if (v0 && !defaults().some(([v]) => v === v0)) { const k = issueById(first); extra = ['i:' + first, k ? `${issueLabel(k, ctx)}${k.archived_at ? ', archived' : ''}` : 'An archived issue']; }
  const opts = () => [...defaults(), ...(extra ? [extra] : [])];
  const chairNames = asking ? andList(asking.ids.map(legById).filter(Boolean).map(shortName)) : '';
  const body = `<div class="cv-sheet">
    <div class="field cv-whof" role="group" aria-labelledby="cv-who-l">
      <span class="label" id="cv-who-l">With whom</span>
      <div class="chips cv-picked" data-cvpicked>${pickedHTML(picked)}</div>
      <div class="cv-find">${icon('search')}<input id="cv-q" type="search" autocomplete="off" placeholder="Name, district or committee" aria-label="Add a legislator: name, district or committee" aria-describedby="cv-who-e"${desk && !picked.length ? ' autofocus' : ''}></div>
      <div class="cv-sgs" data-cvsg>${sgHTML(picked, q, sugg)}</div>
      <span class="err" id="cv-who-e" hidden>${icon('circle-alert')}Pick at least one legislator.</span>
    </div>
    <div class="field"><label for="cv-text">What was said</label><textarea id="cv-text" rows="5" maxlength="4000" autocapitalize="sentences" spellcheck="true" placeholder="What they said, what they asked for, what we promised" aria-describedby="cv-text-e"${desk && picked.length ? ' autofocus' : ''}>${esc(g ? g.body : held ? held.text : text)}</textarea>
      <span class="err" id="cv-text-e" hidden>${icon('circle-alert')}Write what was said first.</span>
      ${held ? `<span class="help cv-held">${icon('history')}Your note from before, kept until you save it.</span>` : ''}</div>
    ${asking ? `<div class="field cv-askf"><label class="cv-ask"><input type="checkbox" id="cv-ask"${ask ? ' checked' : ''} aria-describedby="cv-ask-h cv-ask-e"><span>This was an ask for a hearing</span></label>
      <span class="help" id="cv-ask-h">${esc(`Counts as the ask to ${chairNames} on ${billSay(ctx)}, as an email to the chair does.`)}</span>
      <span class="err" id="cv-ask-e" hidden>${icon('circle-alert')}${esc(`Add ${chairNames} under With whom to count it as the ask.`)}</span></div>` : ''}
    <fieldset class="field cv-aboutf"><legend>Filed under</legend>
      <div class="cv-opts" data-cvopts>${radioHTML(opts(), v0 && opts().some(([v]) => v === v0) ? v0 : opts()[0][0])}</div>
      <div class="cv-find cv-ifind">${icon('search')}<input id="cv-iq" type="search" autocomplete="off" placeholder="Find another issue" aria-label="Find another issue to file it under" aria-controls="cv-ilist"></div>
      <div class="cv-ilist" id="cv-ilist" data-cvil></div>
    </fieldset>
    <div class="field cv-dayf"><label for="cv-day">When</label><input id="cv-day" type="date" value="${esc(g ? g.day : hiToday())}" max="${esc(hiToday())}"></div>
    <p class="cv-reach" aria-live="polite">${esc(reachLine(ctx, v0))}</p>
  </div>`;
  openSheet({ title: g ? 'Edit this talk' : 'Log a talk', size: 'auto', body,
    foot: btn(g ? 'Save changes' : 'Save', { icon: 'check', attrs: { 'data-cvsave': '1' } }),
    wire: d => {
      const qi = d.querySelector('#cv-q'), sg = d.querySelector('[data-cvsg]'), pk = d.querySelector('[data-cvpicked]'), optsEl = d.querySelector('[data-cvopts]');
      const iq = d.querySelector('#cv-iq'), il = d.querySelector('[data-cvil]'), askBox = d.querySelector('#cv-ask'), askErr = d.querySelector('#cv-ask-e');
      const ta = d.querySelector('#cv-text'), whoErr = d.querySelector('#cv-who-e'), txtErr = d.querySelector('#cv-text-e'), reach = d.querySelector('.cv-reach');
      const about = () => d.querySelector('input[name="cv-about"]:checked')?.value ?? '';
      const drawOpts = (v = about()) => { optsEl.innerHTML = radioHTML(opts(), opts().some(([x]) => x === v) ? v : opts()[0][0]); reach.textContent = reachLine(ctx, about()); };
      optsEl.addEventListener('change', () => { reach.textContent = reachLine(ctx, about()); });
      // Another issue: what is typed finds it (the committees' issues first); a pick joins the choices, chosen.
      const hits = () => {
        const shown = new Set(opts().map(([v]) => v)), list = issueHits(iq.value, ctx, picked, shown), t = iq.value.trim();
        il.innerHTML = list.length ? `${t ? '' : '<p class="cv-sgh">Their committees’ issues</p>'}<div class="sv-pickl cv-ipick">${list.map(i => `<button type="button" data-cvissue="${esc(i.id)}"><span class="body"><span class="title">${esc(i.name)}</span>${issueNums(i, ctx) ? `<span class="sub">${esc(issueNums(i, ctx))}</span>` : ''}</span>${icon('plus', { cls: 'cv-plus' })}</button>`).join('')}</div>`
          : t ? `<p class="cv-sgnone">No issue matches “${esc(t)}”.</p>` : '';
        il.querySelectorAll('[data-cvissue]').forEach(el => el.onclick = () => { const i = issueById(el.dataset.cvissue); if (!i) return;
          extra = ['i:' + i.id, issueLabel(i, ctx)]; iq.value = ''; il.innerHTML = ''; drawOpts(extra[0]); optsEl.querySelector('input:checked')?.focus(); });
      };
      iq.oninput = hits; iq.onfocus = () => { if (!iq.value) hits(); };
      iq.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); il.querySelector('[data-cvissue]')?.click(); } else if (e.key === 'Escape' && iq.value) { e.preventDefault(); e.stopPropagation(); iq.value = ''; il.innerHTML = ''; } };
      const paint = () => {
        pk.innerHTML = pickedHTML(picked); sg.innerHTML = sgHTML(picked, q, sugg);
        if (!ctx && !issueId) drawOpts();   // "Only Rep. Kila's page" names who it is with
        pk.querySelectorAll('[data-cvrm]').forEach(el => el.onclick = () => {
          const id = +el.dataset.cvrm, at = picked.indexOf(id); picked = picked.filter(x => x !== id); paint();
          (pk.querySelectorAll('[data-cvrm]')[Math.min(at, picked.length - 1)] || qi).focus();
        });
        sg.querySelectorAll('[data-cvadd]').forEach(el => el.onclick = () => add(+el.dataset.cvadd));
        if (askErr && asking.ids.some(id => picked.includes(id))) askErr.hidden = true;
        if (ta.value.trim()) keep();   // who it was with is kept with the words
      };
      const add = id => {
        if (!picked.includes(id)) picked.push(id);
        q = ''; qi.value = ''; whoErr.hidden = true; qi.removeAttribute('aria-invalid'); paint();
        if (desk) qi.focus();                    // a phone keeps its keyboard down: the next tap is usually another name or the words
      };
      qi.oninput = () => { q = qi.value; sg.innerHTML = sgHTML(picked, q, sugg); sg.querySelectorAll('[data-cvadd]').forEach(el => el.onclick = () => add(+el.dataset.cvadd)); };
      qi.onkeydown = e => {
        if (e.key === 'Enter') { e.preventDefault(); sg.querySelector('[data-cvadd]')?.click(); }
        else if (e.key === 'ArrowDown') { const f = sg.querySelector('[data-cvadd]'); if (f) { e.preventDefault(); f.focus(); } }
        else if (e.key === 'Escape' && qi.value) { e.preventDefault(); e.stopPropagation(); qi.value = ''; qi.oninput(); }
        else if (e.key === 'Backspace' && !qi.value && picked.length) { picked.pop(); paint(); }
      };
      if (askBox) askBox.onchange = () => { askErr.hidden = true; };
      const keep = () => { if (nk) holdNote(nk, { text: ta.value, picked }); };
      ta.oninput = () => { txtErr.hidden = true; ta.removeAttribute('aria-invalid'); keep(); };
      paint();
      d.querySelector('[data-cvsave]').onclick = async e => {
        const words = ta.value.trim(), asked = !!askBox?.checked, chairsIn = asked ? asking.ids.filter(id => picked.includes(id)) : [];
        if (!picked.length) { whoErr.hidden = false; qi.setAttribute('aria-invalid', 'true'); }
        if (!words) { txtErr.hidden = false; ta.setAttribute('aria-invalid', 'true'); }
        if (asked && picked.length && !chairsIn.length) askErr.hidden = false;
        if (!picked.length || !words || (asked && !chairsIn.length)) { (!picked.length || (asked && !chairsIn.length) ? qi : ta).focus(); return; }
        if (!S.me) { toast('Your login is not linked to a staff record yet. Ask your admin.', { err: true }); return; }
        const v = about(), issue = v.startsWith('i:') ? v.slice(2) : null, day = d.querySelector('#cv-day').value || hiToday();
        const go = e.currentTarget; go.setAttribute('aria-busy', 'true'); go.disabled = true;
        const names = andList(picked.map(legById).filter(Boolean).map(shortName));
        try {
          if (g) {
            const undo = await correct(g, { picked, words, issue, day });
            await closeSheet({ silent: true }); onDone();
            toast('Saved.', { ok: true, undo: async () => { await undo(); onDone(); toast('Put back as it was.'); } });
          } else {
            const made = await logNew({ ctx, picked, words, issue, day, ask: asked ? { code: asking.code, ids: chairsIn } : null });
            if (nk) holdNote(nk, null);   // saved: the held words have done their job
            await closeSheet({ silent: true }); onDone();
            toast(`Logged your talk with ${names}.${asked ? ` It counts as the ask for ${asking.decide ? 'decision making' : 'a hearing'} on ${billSay(ctx)}.` : ''}`, { ok: true, undo: async () => {
              for (const r of made) await DB.delLegNote(r.id, r.legislator_id); onDone(); toast('Removed.'); } });
          }
        } catch (x) { if (go.isConnected) { go.removeAttribute('aria-busy'); go.disabled = false; } toast(x, { err: true }); }
      };
    } });
}
// ---- R-335 (practice copy): Add a note ----
// A dated note about one legislator, beside Log a conversation: something that happened that was not a meeting or a call
// ("spoke at the HLT hearing", "back from leave on the 20th"). What holds from week to week belongs in their Profile
// (profile.js). It goes in the same log as a conversation, marked as a note, with no issue, bill or other legislators, so it
// shows only on their page. The words are held while typed (C-9), as a conversation's are.
export function addNote({ legId = null, edit = null, onDone = () => hooks.render() } = {}) {
  const g = edit, lid = g ? g.legs[0] : legId, l = legById(lid); if (!l) return;
  const nk = g ? null : `nt:${lid}`, held = nk ? heldNote(nk) : null;
  const body = `<div class="cv-sheet">
    <p class="cv-nfor">${esc(shortName(l))}</p>
    <div class="field"><label for="cv-ntext">Note</label><textarea id="cv-ntext" rows="4" maxlength="4000" autocapitalize="sentences" spellcheck="true" placeholder="What happened, for example: spoke at the HLT hearing, or back from leave on the 20th" aria-describedby="cv-ntext-e">${esc(g ? g.body : held?.text || '')}</textarea>
      <span class="err" id="cv-ntext-e" hidden>${icon('circle-alert')}Write the note first.</span>
      ${held ? `<span class="help cv-held">${icon('history')}Your note from before, kept until you save it.</span>` : ''}</div>
    <div class="field cv-dayf"><label for="cv-nday">Date</label><input id="cv-nday" type="date" value="${esc(g ? g.day : hiToday())}" max="${esc(hiToday())}"></div>
    <p class="cv-reach">Team only. Shows in ${esc(shortName(l))}’s Asks and talks.</p>
  </div>`;
  openSheet({ title: g ? 'Edit this note' : 'Add a note', size: 'auto', body,
    foot: btn(g ? 'Save changes' : 'Save note', { icon: 'check', attrs: { 'data-cvnsave': '1' } }),
    wire: d => {
      const ta = d.querySelector('#cv-ntext'), err = d.querySelector('#cv-ntext-e');
      ta.focus();
      ta.oninput = () => { err.hidden = true; ta.removeAttribute('aria-invalid'); if (nk) holdNote(nk, { text: ta.value }); };
      d.querySelector('[data-cvnsave]').onclick = async e => {
        const words = ta.value.trim(), day = d.querySelector('#cv-nday').value || hiToday();
        if (!words) { err.hidden = false; ta.setAttribute('aria-invalid', 'true'); ta.focus(); return; }
        if (!S.me) { toast('Your login is not linked to a staff record yet. Ask your admin.', { err: true }); return; }
        const go = e.currentTarget; go.setAttribute('aria-busy', 'true'); go.disabled = true;
        try {
          if (g) {
            const undo = await correct(g, { picked: g.legs, words, issue: null, day });
            await closeSheet({ silent: true }); onDone();
            toast('Saved. The earlier wording is kept.', { ok: true, undo: async () => { await undo(); onDone(); toast('Put back as it was.'); } });
          } else {
            const r = await DB.addLegNote(lid, null, words, { metOn: day, conversationId: uuid(), kind: 'note' });
            if (nk) holdNote(nk, null);
            await closeSheet({ silent: true }); onDone();
            toast(`Note added to ${shortName(l)}’s page.`, { ok: true, undo: async () => { await DB.delLegNote(r.id, r.legislator_id); onDone(); toast('Removed.'); } });
          }
        } catch (x) { if (go.isConnected) { go.removeAttribute('aria-busy'); go.disabled = false; } toast(x, { err: true }); }
      };
    } });
}

// One row per legislator, one conversation id. If a row is refused half way, the rows already written are taken back.
// With the ask ticked (V24), each chair's row carries the answer "asked" and the committee: the record every board reads.
async function logNew({ ctx, picked, words, issue, day, ask = null }) {
  const conversationId = uuid(), made = [];
  try { for (const id of picked) made.push(await DB.addLegNote(id, ctx?.id || null, words, { issueId: issue, metOn: day, conversationId, ...(ask && ask.ids.includes(id) ? { answer: 'asked', committee: ask.code } : {}) })); }
  catch (e) { for (const r of made) await DB.delLegNote(r.id, r.legislator_id).catch(() => {}); throw e; }
  return made;
}
// A correction: the words, the issue and the day on each row that stays, a row for anyone added, none for anyone taken
// off. The rows that stay are written first: after ten minutes the database refuses, and nothing else has changed yet.
// Returns the Undo.
async function correct(g, { picked, words, issue, day }) {
  const any = PROFILES();   // R-335 (practice copy): any time, and a change of words keeps the words before it
  if (!fresh(g) && !any) throw new Error(LATE);
  const cid = g.id || uuid();
  const keep = g.rows.filter(r => picked.includes(r.legislator_id)), gone = g.rows.filter(r => !picked.includes(r.legislator_id));
  const add = picked.filter(id => !g.rows.some(r => r.legislator_id === id));
  const before = keep.map(r => ({ id: r.id, body: r.body, issue_id: r.issue_id ?? null, met_on: r.met_on ?? null, conversation_id: r.conversation_id ?? null,
    ...(any ? { history: r.history || [], edited_at: r.edited_at || null, edited_by: r.edited_by || null } : {}) }));
  const patch = { body: words, issue_id: issue, met_on: day, ...(g.id ? {} : { conversation_id: cid }) };
  const now = new Date().toISOString();
  const kept = r => !any || r.body === words ? {} : { history: [{ body: r.body, by: r.edited_by || r.advocate_id, at: r.edited_at || r.created_at }, ...(r.history || [])], edited_at: now, edited_by: S.me?.id };
  const made = [];
  for (const r of keep) await DB.updateLegNote(r.id, { ...patch, ...kept(r) });   // refused after ten minutes, and the data layer puts it back
  for (const id of add) made.push(await DB.addLegNote(id, g.bill_id, words, { issueId: issue, metOn: day, conversationId: cid }));
  for (const r of gone) await DB.delLegNote(r.id, r.legislator_id);
  return async () => {
    for (const p of before) await DB.updateLegNote(p.id, { body: p.body, issue_id: p.issue_id, met_on: p.met_on, ...(g.id ? {} : { conversation_id: p.conversation_id }),
      ...(any ? { history: p.history, edited_at: p.edited_at, edited_by: p.edited_by } : {}) });
    for (const r of made) await DB.delLegNote(r.id, r.legislator_id);
    for (const r of gone) await DB.addLegNote(r.legislator_id, r.bill_id, r.body, { issueId: r.issue_id, metOn: r.met_on, conversationId: r.conversation_id || cid });
  };
}
