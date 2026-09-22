// HIPHI Staff v2 · conversations with legislators (R-022 wave 2 #9, migration 064). A person comes here to record what a
// legislator said, so that the next person finds it (B-1). Nate, 9/21: "A conversation with a legislator is more of an
// issue conversation than a bill specific conversation." So a conversation is filed under an issue (and under the bill
// it was logged from, when there was one), and one meeting with several legislators is one row per legislator sharing a
// conversation_id. It shows on each legislator's page, on the issue's page and on every bill of that issue (their
// Activity tab): one record found in three places, where notes used to live in three places that never met.
// The same dialog and the same list serve all three pages. Your own entry can be corrected or deleted for ten minutes
// (the database enforces the ten minutes for a correction); after that it is the record, and only an admin can delete it.
import { S, DB, DEMO, esc, fmtDate, advocate, hooks } from './data.js';
import { legById, billById, stopOf, legsOf, cmteName, hiToday, hstDayOf, diedish } from './model.js';
import { icon, btn, iconBtn, chip, toast, openSheet, closeSheet, menuSheet } from './ui.js';
import { issuesOfBill, issueById } from './issues.js';
import { photo, shortName, partyDist, legHref, roleWord, seatsText } from './pathway.js';
import { matchLegs } from './legislators.js';

const WINDOW = 10 * 60e3;
const LATE = 'This conversation can no longer be changed: notes can be corrected for ten minutes after they are saved.';
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
      day: r.met_on || hstDayOf(at || Date.now()), created_at: at, advocate_id: r.advocate_id, legs: [...new Set(rs.map(x => x.legislator_id))] };
  }).sort((a, b) => b.day.localeCompare(a.day) || String(b.created_at).localeCompare(String(a.created_at)));
}
const hiddenNow = () => (S.cvHidden ??= new Set());
export const convCount = rows => groupsOf(rows).filter(g => !hiddenNow().has(g.key)).length;
const fresh = g => Date.now() - new Date(g.created_at).getTime() < WINDOW;
const mine = g => !!S.me && g.advocate_id === S.me.id;
const canTouch = g => (mine(g) && fresh(g)) || !!S.me?.is_admin;

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
  const meta = [esc(dayOf(g.day)), mine(g) ? 'you logged it' : `${esc(firstName(who))} logged it`,
    bill ? `on <a href="#/bill/${esc(bill.bill_number)}">${esc(bill.bill_number)}</a>` : ''].filter(Boolean).join(' · ');
  return `<article class="row cv-item" data-cvkey="${esc(g.key)}">
    <div class="cv-main">
      ${head ? `<p class="cv-names">${head}</p>` : ''}
      <p class="cv-meta"><span>${meta}</span>${iss ? chip(iss.name, '', 'tag') : ''}</p>
      <p class="cv-text">${esc(g.body)}</p>
    </div>
    ${canTouch(g) ? iconBtn('ellipsis', 'More for this conversation', { 'data-cvmore': g.key }, 'cv-more') : ''}
  </article>`;
}
export function convListHTML(rows, here = {}, { limit = 3, key = 'cv', none = 'No conversations logged yet.' } = {}) {
  const gs = groupsOf(rows).filter(g => !hiddenNow().has(g.key));
  if (!gs.length) return `<p class="cv-none">${none}</p>`;
  const all = !limit || (S.cvAll ??= new Set()).has(key) || gs.length <= limit + 1;
  const shown = all ? gs : gs.slice(0, limit);
  return `<div class="rows cv-list">${shown.map(g => itemHTML(g, here)).join('')}</div>
    ${shown.length < gs.length ? btn(`Show all ${gs.length}`, { kind: 'text', icon: 'chevron-down', cls: 'cv-all', attrs: { 'data-cvall': key } }) : ''}`;
}
// rows(): the rows as they are now; redraw(): paint the list again (a whole page, or just this box).
export function wireConvList(box, { rows, redraw }) {
  if (!box) return;
  box.querySelectorAll('[data-cvall]').forEach(el => el.onclick = () => { (S.cvAll ??= new Set()).add(el.dataset.cvall); redraw(); });
  box.querySelectorAll('[data-cvmore]').forEach(el => el.onclick = () => { const g = groupsOf(rows()).find(x => x.key === el.dataset.cvmore); if (g) convMenu(g, redraw); });
}
function convMenu(g, redraw) {
  const ok = fresh(g), admin = !!S.me?.is_admin;
  const late = 'Notes can be corrected for ten minutes after they are saved. After that they are the record.';
  menuSheet({ title: 'Conversation', items: [
    mine(g) ? { label: 'Edit', icon: 'pencil', sub: 'For ten minutes after it is saved', disabled: !ok, reason: late, run: () => afterBack(() => logConversation({ edit: g, onDone: redraw })) } : null,
    mine(g) || admin ? { label: 'Delete', icon: 'trash-2', danger: true, disabled: !ok && !admin, reason: late, run: () => removeConv(g, redraw) } : null,
  ] });
}
// Delete acts at once and offers Undo; the rows go for good only once the Undo has gone (B-5), as the legislator page did.
function removeConv(g, redraw) {
  hiddenNow().add(g.key); redraw();
  const t = setTimeout(async () => {
    try { for (const r of g.rows) await DB.delLegNote(r.id, r.legislator_id); }
    catch { toast('Could not delete the conversation. It is back.', { err: true }); }
    hiddenNow().delete(g.key); redraw();
  }, 10000);
  toast('Conversation deleted.', { undo: () => { clearTimeout(t); hiddenNow().delete(g.key); redraw(); } });
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
export function convSectionHTML({ id, q, here = {}, title = 'Conversations', kind = 'bw', limit = 3, none }) {
  const rows = S.convCache?.[qKey(q)] || null, n = rows ? convCount(rows) : 0;
  const act = btn('Log a conversation', { kind: 'text', icon: 'message-square-plus', attrs: { 'data-cvlog': id, 'aria-haspopup': 'dialog' } });
  return `${HEAD[kind](id, title, ` <span class="cv-n" data-cvn${n ? '' : ' hidden'}>${n || ''}</span>`, act)}
    <div class="cv-box" data-cvbox>${rows ? convListHTML(rows, here, { limit, key: id, none }) : `<p class="cv-none cv-wait">${icon('loader-circle')}Loading the conversations…</p>`}</div>
  </section>`;
}
// log: what the dialog opens with ({ bill } or { issueId }).
export function wireConvSection(root, { id, q, here = {}, limit = 3, none, log = {} }) {
  const sec = root.querySelector(`[data-cvsec="${id}"]`); if (!sec) return;
  const box = sec.querySelector('[data-cvbox]'), n = sec.querySelector('[data-cvn]');
  let rows = S.convCache?.[qKey(q)] || null, drawn = rows ? sigOf(rows, id) : '';
  const paint = () => {
    if (!box.isConnected) return;
    drawn = sigOf(rows || [], id);
    box.innerHTML = convListHTML(rows || [], here, { limit, key: id, none });
    const c = convCount(rows || []); n.textContent = c || ''; n.hidden = !c;
    wireConvList(box, { rows: () => rows || [], redraw: refresh });
  };
  // Painted again only when something changed, so a focused button or a half-read list is not swapped out from under you.
  const refresh = () => DB.conversations(q).then(r => { rows = r || []; if (sigOf(rows, id) !== drawn) paint(); })
    .catch(() => { if (box.isConnected && !rows) box.innerHTML = '<p class="cv-none">The conversations did not load. Try again in a moment.</p>'; });
  mounted.set(id, refresh);
  sec.querySelector('[data-cvlog]').onclick = () => logConversation({ ...log, onDone: refreshConversations });
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
  const label = !list.length ? '' : bill ? `On ${cmteName(codes[0])}` : codes.length === 1 ? `On ${cmteName(codes[0])}` : 'On the committees holding its bills';
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
// The bill's own issues first (the default is its first), then "Only HB1562" (Nate: "allow just this bill when it has
// none"), then every other issue by category. With no bill (a legislator's or an issue's page) the first choice is the
// legislator's page only, then the issues of the bills in the legislators' committees now.
// Each issue says it is one and names its bills, "Issue: Youth mental health app pilot (HB1562, SB2679)": 55 of the 91
// issues share a bill's nickname, so a bare name read as the bill and nobody could tell they were choosing an issue
// (R-022 review, 9/21).
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
// An issue's bills as numbers, the bill you are on first: where a conversation filed under it shows.
const numsOf = (issueId, ctx) => {
  const bs = (S.billIssues || []).filter(x => x.issue_id === issueId).map(x => billById(x.bill_id)).filter(Boolean);
  if (ctx && !bs.some(x => x.id === ctx.id)) bs.push(ctx);   // filed from a bill that is not on it: it shows there too
  return [...new Set(bs.sort((a, b) => (b.id === ctx?.id) - (a.id === ctx?.id) || a.bill_number.localeCompare(b.bill_number, 'en', { numeric: true })).map(x => x.bill_number))];
};
const issueLabel = (i, ctx) => { const n = numsOf(i.id, ctx);
  return `Issue: ${i.name}${n.length ? ` (${n.slice(0, 3).join(', ')}${n.length > 3 ? `, +${n.length - 3}` : ''})` : ''}`; };
function aboutOptions(ctx, picked, keep) {
  const opt = (v, label) => `<option value="${esc(v)}">${esc(label)}</option>`, lab = i => issueLabel(i, ctx);
  const own = ctx ? issuesOfBill(ctx.id) : [], near = ctx ? [] : nearIssues(picked);
  const used = new Set([...own, ...near].map(i => i.id));
  let html = own.map(i => opt('i:' + i.id, lab(i))).join('') + opt('', ctx ? `Only ${ctx.bill_number}` : picked.length > 1 ? 'Only the legislators’ pages' : 'Only the legislator’s page');
  if (near.length) html += `<optgroup label="Their committees’ issues">${near.map(i => opt('i:' + i.id, lab(i))).join('')}</optgroup>`;
  for (const c of S.categories || []) {
    const l = liveIssues().filter(i => i.category === c.key && !used.has(i.id)).sort((a, b) => a.name.localeCompare(b.name));
    l.forEach(i => used.add(i.id));
    if (l.length) html += `<optgroup label="${esc(c.name)}">${l.map(i => opt('i:' + i.id, lab(i))).join('')}</optgroup>`;
  }
  const k = keep && issueById(keep);          // an issue archived since: still shown, so an edit does not lose it
  if (keep && !used.has(keep)) html += opt('i:' + keep, k ? `${lab(k)}, archived` : 'An archived issue');
  return html;
}
// Where it will show, in bill numbers: "Team only. Shows on each legislator's page and on HB1562 and SB2679."
function reachLine(ctx, v) {
  const nums = v.startsWith('i:') ? numsOf(v.slice(2), ctx) : ctx ? [ctx.bill_number] : [];
  const bills = nums.length > 4 ? `${nums.slice(0, 3).join(', ')} and ${nums.length - 3} more bills` : andList(nums);
  return `Team only. Shows on each legislator’s page${bills ? ` and on ${bills}` : ''}.`;
}

// ---- the dialog: log one, or correct your own ----
// edit: a conversation from groupsOf(). text: words already typed elsewhere (Log activity > Meeting hands them over).
export function logConversation({ bill = null, issueId = null, legislatorIds = [], text = '', edit = null, onDone = () => hooks.render() } = {}) {
  const g = edit, ctx = g ? (g.bill_id ? billById(g.bill_id) || null : null) : bill;
  let picked = g ? [...g.legs] : [...new Set((legislatorIds || []).map(Number))].filter(id => legById(id));
  let q = '';
  const first = g ? g.issue_id : issueId || (ctx ? issuesOfBill(ctx.id)[0]?.id : null) || null;
  const sugg = suggestFor({ bill: ctx, issueId: ctx ? null : first });
  const desk = hover(), v0 = first ? 'i:' + first : '';
  const body = `<div class="cv-sheet">
    <div class="field cv-whof" role="group" aria-labelledby="cv-who-l">
      <span class="label" id="cv-who-l">With whom</span>
      <div class="chips cv-picked" data-cvpicked>${pickedHTML(picked)}</div>
      <div class="cv-find">${icon('search')}<input id="cv-q" type="search" autocomplete="off" placeholder="Name, district or committee" aria-label="Add a legislator: name, district or committee" aria-describedby="cv-who-e"${desk && !picked.length ? ' autofocus' : ''}></div>
      <div class="cv-sgs" data-cvsg>${sgHTML(picked, q, sugg)}</div>
      <span class="err" id="cv-who-e" hidden>${icon('circle-alert')}Pick at least one legislator.</span>
    </div>
    <div class="cv-row2">
      <div class="field"><label for="cv-about">Filed under</label><select id="cv-about">${aboutOptions(ctx, picked, first)}</select></div>
      <div class="field cv-dayf"><label for="cv-day">When</label><input id="cv-day" type="date" value="${esc(g ? g.day : hiToday())}" max="${esc(hiToday())}"></div>
    </div>
    <div class="field"><label for="cv-text">What was said</label><textarea id="cv-text" rows="5" maxlength="4000" autocapitalize="sentences" spellcheck="true" placeholder="What they said, what they asked for, what we promised" aria-describedby="cv-text-e"${desk && picked.length ? ' autofocus' : ''}>${esc(g ? g.body : text)}</textarea>
      <span class="err" id="cv-text-e" hidden>${icon('circle-alert')}Write what was said first.</span></div>
    <p class="small muted cv-reach" aria-live="polite">${esc(reachLine(ctx, v0))}</p>
  </div>`;
  openSheet({ title: g ? 'Edit this conversation' : 'Log a conversation', size: 'auto', body,
    foot: btn(g ? 'Save changes' : 'Save conversation', { icon: 'check', attrs: { 'data-cvsave': '1' } }),
    wire: d => {
      const qi = d.querySelector('#cv-q'), sg = d.querySelector('[data-cvsg]'), pk = d.querySelector('[data-cvpicked]'), about = d.querySelector('#cv-about');
      const ta = d.querySelector('#cv-text'), whoErr = d.querySelector('#cv-who-e'), txtErr = d.querySelector('#cv-text-e'), reach = d.querySelector('.cv-reach');
      about.value = v0; if (about.value !== v0) about.selectedIndex = 0;
      const paint = () => {
        pk.innerHTML = pickedHTML(picked); sg.innerHTML = sgHTML(picked, q, sugg);
        if (!ctx) { const cur = about.value; about.innerHTML = aboutOptions(ctx, picked, first); about.value = cur; }
        pk.querySelectorAll('[data-cvrm]').forEach(el => el.onclick = () => {
          const id = +el.dataset.cvrm, at = picked.indexOf(id); picked = picked.filter(x => x !== id); paint();
          (pk.querySelectorAll('[data-cvrm]')[Math.min(at, picked.length - 1)] || qi).focus();
        });
        sg.querySelectorAll('[data-cvadd]').forEach(el => el.onclick = () => add(+el.dataset.cvadd));
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
      about.onchange = () => { reach.textContent = reachLine(ctx, about.value); };
      ta.oninput = () => { txtErr.hidden = true; ta.removeAttribute('aria-invalid'); };
      paint();
      d.querySelector('[data-cvsave]').onclick = async e => {
        const words = ta.value.trim();
        if (!picked.length) { whoErr.hidden = false; qi.setAttribute('aria-invalid', 'true'); }
        if (!words) { txtErr.hidden = false; ta.setAttribute('aria-invalid', 'true'); }
        if (!picked.length || !words) { (!picked.length ? qi : ta).focus(); return; }
        if (!S.me) { toast('Your login is not linked to a staff record yet. Ask your admin.', { err: true }); return; }
        const v = about.value, issue = v.startsWith('i:') ? v.slice(2) : null, day = d.querySelector('#cv-day').value || hiToday();
        const go = e.currentTarget; go.setAttribute('aria-busy', 'true'); go.disabled = true;
        const names = andList(picked.map(legById).filter(Boolean).map(shortName));
        try {
          if (g) {
            const undo = await correct(g, { picked, words, issue, day });
            await closeSheet({ silent: true }); onDone();
            toast('Saved.', { ok: true, undo: async () => { await undo(); onDone(); toast('Put back as it was.'); } });
          } else {
            const made = await logNew({ ctx, picked, words, issue, day });
            await closeSheet({ silent: true }); onDone();
            toast(`Logged your conversation with ${names}.`, { ok: true, undo: async () => {
              for (const r of made) await DB.delLegNote(r.id, r.legislator_id); onDone(); toast('Removed.'); } });
          }
        } catch (x) { if (go.isConnected) { go.removeAttribute('aria-busy'); go.disabled = false; } toast(x, { err: true }); }
      };
    } });
}
// One row per legislator, one conversation id. If a row is refused half way, the rows already written are taken back.
async function logNew({ ctx, picked, words, issue, day }) {
  const conversationId = uuid(), made = [];
  try { for (const id of picked) made.push(await DB.addLegNote(id, ctx?.id || null, words, { issueId: issue, metOn: day, conversationId })); }
  catch (e) { for (const r of made) await DB.delLegNote(r.id, r.legislator_id).catch(() => {}); throw e; }
  return made;
}
// A correction: the words, the issue and the day on each row that stays, a row for anyone added, none for anyone taken
// off. The rows that stay are written first: after ten minutes the database refuses, and nothing else has changed yet.
// Returns the Undo.
async function correct(g, { picked, words, issue, day }) {
  if (!fresh(g)) throw new Error(LATE);
  const cid = g.id || uuid();
  const keep = g.rows.filter(r => picked.includes(r.legislator_id)), gone = g.rows.filter(r => !picked.includes(r.legislator_id));
  const add = picked.filter(id => !g.rows.some(r => r.legislator_id === id));
  const before = keep.map(r => ({ id: r.id, body: r.body, issue_id: r.issue_id ?? null, met_on: r.met_on ?? null, conversation_id: r.conversation_id ?? null }));
  const patch = { body: words, issue_id: issue, met_on: day, ...(g.id ? {} : { conversation_id: cid }) };
  const made = [];
  for (const r of keep) await DB.updateLegNote(r.id, patch);   // refused after ten minutes, and the data layer puts it back
  for (const id of add) made.push(await DB.addLegNote(id, g.bill_id, words, { issueId: issue, metOn: day, conversationId: cid }));
  for (const r of gone) await DB.delLegNote(r.id, r.legislator_id);
  return async () => {
    for (const p of before) await DB.updateLegNote(p.id, { body: p.body, issue_id: p.issue_id, met_on: p.met_on, ...(g.id ? {} : { conversation_id: p.conversation_id }) });
    for (const r of made) await DB.delLegNote(r.id, r.legislator_id);
    for (const r of gone) await DB.addLegNote(r.legislator_id, r.bill_id, r.body, { issueId: r.issue_id, metOn: r.met_on, conversationId: r.conversation_id || cid });
  };
}
