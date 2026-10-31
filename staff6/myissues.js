// My issues (#/issues, R-263, Nate 10/12): staff own issues and work bills. "Should there instead be an issues tab with
// bills falling within the different issues? And staff instead 'own' issues, rather than bills?" His answers: its own
// place in the main menu, for everyone on staff, and helpers get the bills too. So this is each person's issues (the ones
// they own or help on, from the 2027 prep's owners and helpers, 091), soonest work first, each with where it stands. The
// bills on these issues are also in Bills > Mine, Today and the inbox (data.js isMine; backend migration 172).
// v5 (R-272, Nate 10/13: "I shouldn't have to scroll alphabetically ... Rethink this"): one line per issue, sorted by
// deadline (This week, Next deadlines, Safe for now), with a By topic switch and a search box as extras; each line says
// whether the issue is at risk of dying, safe with a bill dying, or safe (issuestand.js, shared with All issues).
// v6 (R-336 spec 6): the same list, restyled and trimmed (a name and one line a row, V04), not reorganised. Two lines above
// it, each only when it applies, replace what v5 put elsewhere:
//   - "2 bills on your issues have no owner · Take one" (F52): Today's "No owner · Take it" rows leave Today (V01, critic);
//   - "2 of your top issues have no bill yet · introduction closes Wed 1/28" (F141, the opening weeks): v5 said it only
//     inside Legislators › Holding, where an issue owner would not look.
// R-356 round 3 (Nate 31 Oct, A-1): the page is the Issues tabs, then one row (the Deadlines | Status | Topics | Spreadsheet
// switch and the filter box), then the first issue; the notes above (no owner, no bill yet, your coalition) now come under that
// row, so nothing but the row stands between the tabs and the list's start.
// Between sessions My issues is the 2027 prep list (W16, prep.js), as Nate chose for Staff v2 on 10/16.
// Someone who owns and helps on no issue (Patti, Julie, Saya, Kris, Jess) sees their coalitions instead (v4, R-269 P7):
// the ones they help on as rows, then the others, each with an I help switch (coalition.js).
// v6 walk 3 (Nate 25 Oct, twelve mockups): the list is handed to myviews.js, which draws its views behind one remembered
// switch. Walk 4 (Nate, the same day): the default is Deadlines, each issue under the deadline it must beat next with its
// House | Senate cells (walk 3's Coverage and the column board folded into it), then Status, Topics and Spreadsheet (R-352
// FIX-3, Nate 28 Oct: "keep the topics and spreadsheet tabs"). This file keeps the page: the head, the lines above, the filter, the prep list and the coalition fallback.
import { S, DB, DEADLINES, SESSION_OVER, hooks, esc, myIssueIds } from './data.js';
import { diedish } from './model.js';
import { icon, btn, empty, toast, openSheet, closeSheet } from './ui.js';
import { plural } from './lists.js';
import { isDraft, myIssuesPrep, renderMinePrep, wireMinePrep } from './prep.js';
import { coalSectionsHTML, wireHelpBtns, billLineRow, helpLineHTML, billWords } from './coalition.js';
import { standOf, wireTools, headHTML, restoreRow, backRecent } from './issuestand.js';
import { toolsHTML, bodyHTML, wireBody, wireSwitch, restoreMine } from './myviews.js';
import { isPos } from './standing.js';
import { dayWords, itemRow } from './steps.js';

// Each of my issues, as issuestand.js judges it (R-272), with whether it is yours or one you help on.
function myIssues() {
  const ids = myIssueIds();
  return (S.issues || []).filter(i => ids.has(String(i.id)) && !i.archived_at).map(i => ({ ...standOf(i), own: i.owner_id === S.me?.id }));
}
const Q = () => S.miSearch ??= { q: '' };
const opts = () => ({ q: Q().q, from: 'mine', tagsOf: x => [x.own ? '' : 'You help', isDraft(x.i) ? 'Not public yet' : ''].filter(Boolean) });

// ---- F52: live bills with a position on an issue you own, that nobody owns ----
const onIssue = i => new Set((S.billIssues || []).filter(x => x.issue_id === i.id).map(x => x.bill_id));
export function unownedOnMine() {
  if (!S.me || SESSION_OVER) return { bills: [], issues: 0 };
  const mine = (S.issues || []).filter(i => i.owner_id === S.me.id && !i.archived_at), seen = new Map(); let n = 0;
  for (const i of mine) { let hit = false;
    for (const id of onIssue(i)) { const b = S.bills.find(x => x.id === id);
      if (!b || b.tracked === false || !isPos(b) || diedish(b) || (S.assignments[b.id] || []).length) continue; seen.set(b.id, b); hit = true; }
    if (hit) n++; }
  return { bills: [...seen.values()], issues: n };
}
// ---- F141: in the opening weeks, your top issues with no bill yet, while introduction is still open ----
export function topsWithNoBill() {
  if (!S.me || SESSION_OVER) return { list: [], cut: null };
  const cut = (DEADLINES.introduced || [])[0]?.[1]; if (!cut || new Date(cut + 'T23:59:59-10:00').getTime() < Date.now()) return { list: [], cut: null };
  const list = (S.issues || []).filter(i => i.owner_id === S.me.id && !i.archived_at && (i.recommended || i.top_pick === 'yes') && !onIssue(i).size);
  return { list, cut };
}
// The two lines: a sentence, an icon, and one text button that opens what it names (never a box: X33, A-14). "No owner yet"
// is the one wording of that fact on every screen of this place (spec 7 rule 6; the critic found three).
function linesHTML() {
  const u = unownedOnMine(), t = topsWithNoBill(), out = [];
  if (u.bills.length) out.push(`<p class="i6-line">${icon('user-round')}<span>${esc(`${plural(u.bills.length, 'bill')} on your ${u.issues === 1 ? 'issue' : 'issues'} ${u.bills.length === 1 ? 'has' : 'have'} no owner yet`)}</span>${btn(u.bills.length === 1 ? 'Take it' : 'Take one', { kind: 'text', sm: true, attrs: { 'data-mi': 'unowned', 'aria-haspopup': 'dialog' } })}</p>`);
  if (t.list.length) out.push(`<p class="i6-line">${icon('flag')}<span>${esc(`${t.list.length === 1 ? 'One of your top issues has' : `${t.list.length} of your top issues have`} no bill yet · introduction closes ${dayWords(t.cut)}`)}</span>${btn(t.list.length === 1 ? 'Open it' : 'See them', { kind: 'text', sm: true, attrs: { 'data-mi': 'tops', ...(t.list.length === 1 ? {} : { 'aria-haspopup': 'dialog' }) } })}</p>`);
  return out.join('');
}
// "Take one": the bills in a sheet, each with Take it (you become its owner, with Undo); the sheet stays open for the next.
function unownedSheet() {
  const body = () => { const { bills } = unownedOnMine();
    return bills.length ? `<div class="v6-list i6-list" role="list">${bills.map(b => billLineRow(b, { button: btn('Take it', { kind: 'secondary', sm: true, attrs: { 'data-mitake': b.id, 'aria-label': `Take ${billWords(b)}: you become its owner` } }) })).join('')}</div>`
      : `<p class="i6-quiet">Every bill on your issues has an owner now.</p>`; };
  openSheet({ title: 'Bills on your issues with no owner yet', size: 'auto', body: `<div class="i6-sheet"><p class="i6-quiet">Take one and it is yours: it shows on your Today and in Bills under Mine.</p><div id="mi-un">${body()}</div></div>`,
    onClose: () => hooks.render(),
    wire: d => {
      const wireRows = () => d.querySelectorAll('[data-mitake]').forEach(el => el.onclick = async () => {
        const b = S.bills.find(x => String(x.id) === el.dataset.mitake); if (!b || !S.me) return;
        el.setAttribute('aria-busy', 'true'); el.disabled = true;
        try { await DB.setOwner(b.id, S.me.id); } catch (e) { el.removeAttribute('aria-busy'); el.disabled = false; toast(e, { err: true }); return; }
        d.querySelector('#mi-un').innerHTML = body(); wireRows(); d.querySelector('[data-mitake]')?.focus();
        toast(`You own ${billWords(b)} now.`, { ok: true, undo: async () => { await DB.setOwner(b.id, null); const box = d.querySelector('#mi-un'); if (box) { box.innerHTML = body(); wireRows(); } else hooks.render(); } });
      });
      wireRows();
    } });
}
function topsSheet() {
  const { list } = topsWithNoBill();
  if (list.length === 1) { S.go(`#/issue/${encodeURIComponent(list[0].id)}?from=mine`); return; }
  openSheet({ title: 'Your top issues with no bill yet', size: 'auto',
    body: `<div class="i6-sheet"><p class="i6-quiet">Put a bill on each from its page, once one is introduced.</p><div class="v6-list i6-list" role="list">${list.map(i => itemRow({ key: i.id, name: i.name, line: 'No bill on it yet', href: `#/issue/${encodeURIComponent(i.id)}?from=mine`, cls: 'i6-row' })).join('')}</div></div>`,
    wire: d => d.querySelectorAll('.v6-row-main').forEach(a => a.addEventListener('click', () => closeSheet({ silent: true }))) });
}

export default {
  tab: 'myissues',
  title: () => 'My issues',
  render() {
    // R-316 W16: between sessions, My issues opens as the 2027 prep list, as Nate chose for Staff v2 on 10/16 (R-263).
    if (myIssuesPrep()) return renderMinePrep();
    const list = myIssues(), head = headHTML('mine');
    const owned = list.filter(x => x.own).length, helped = list.length - owned;
    // Someone with no issue: their coalitions, where their week is (Patti: HEAL in one click).
    // The critic: say why the page shows coalitions, and how an issue would come to be here.
    if (!list.length && (S.campaigns || []).length) return `<div class="le-page i6-page mi6-page">${head}<p class="i6-lede mi-noiss">No issues are yours yet. Owning or helping on an issue adds it here; helping a coalition shows its week below.</p>${coalSectionsHTML()}</div>`;
    if (!list.length) return `<div class="le-page i6-page mi6-page">${head}
      <div class="le-empty">${empty({ title: 'No issues are yours yet', text: 'When you own or help on an issue, it shows here with where it stands.', action: btn('See all issues', { kind: 'secondary', href: '#/issues/all' }) })}</div></div>`;
    // Under the tabs, one line only when it says something the list does not (the critic: "You own 10 issues" counted the
    // rows below it, and "You help on 2." named no noun): for someone who helps on a coalition, that coalition and its week
    // (Patti: "Your coalition: HEAL · 3 hearings this week"), which replaces the lede (A-25); for a helper on issues only,
    // how many they help on.
    const coal = helpLineHTML(), lede = coal || (!owned && helped ? `<p class="i6-lede">You help on ${esc(plural(helped, 'issue'))}. Each owner leads theirs.</p>` : '');
    const lines = linesHTML();
    return `<div class="le-page i6-page mi6-page">
      ${head}
      ${toolsHTML(Q().q, list.length)}
      ${lede || lines ? `<div class="i6-lines">${lede}${lines}</div>` : ''}
      <div id="mi-q-body" class="mi-body">${bodyHTML(list, { q: Q().q, opts: opts() })}</div>
    </div>`;
  },
  wire(route, app) {
    if (myIssuesPrep()) return wireMinePrep(app);
    wireHelpBtns(app);
    const paint = () => { const b = app.querySelector('#mi-q-body'); if (b) { b.innerHTML = bodyHTML(myIssues(), { q: Q().q, opts: opts() }); wireBody(app, { paint }); } };
    wireTools(app, 'mi-q', { get: () => Q().q, set: v => { Q().q = v; }, paint });
    wireSwitch(app, { paint }); wireBody(app, { paint });
    app.querySelector('[data-mi="unowned"]')?.addEventListener('click', unownedSheet);
    app.querySelector('[data-mi="tops"]')?.addEventListener('click', topsSheet);
    if (!restoreMine(app, backRecent)) restoreRow(app);
  },
};
