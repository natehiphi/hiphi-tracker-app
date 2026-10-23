// Outreach > Issues (063, R-018). What the public follows. People follow ISSUES - a policy a resident recognises, like
// "Free school meals for every student" or "Disposable e-cigarette ban" - grouped in six categories, and every bill HIPHI
// takes a position on that carries a followed issue reaches them: this session's, later ones, and next session's once
// they are put on it here. Nate, 9/21: Claude tidies the first list from the nicknames "and staff can adjust", so this
// is where the list is kept: rename, describe, move, recommend, merge two that are really one, archive, and put bills
// on issues (also from a bill's Public tab, and from the queue below).
// The index leads with what would otherwise go unnoticed: position bills this session that no issue carries, which
// nobody following issues would ever hear of. #/issue/:id is one issue (a person comes here to see where it stands and
// what each of its bills needs, R-226, B-1): where it stands, its bills, its followers and its ⋯ menu, laid
// out like a list's page. Its "Show in the first visit" switch (066, R-023) leaves an issue out of a newcomer's first
// visit only. Its "Related issues" (095, R-094) are the issues whose bills a follower of this one is shown first. #/outreach/issues?view=first-visit is the first visit's numbers, ?view=links makes a link (firstvisit.js).
// Getting the issues ready for 2027 (091, R-088) is prep.js: ?view=mine is My issues, ?view=prep the admins' board, and
// the prep card on an issue's page. A new issue is a draft the public never sees until an admin publishes it.
// v3 (R-264, Nate 12 Oct: "too dense ... too much going on at one time"): the index is All issues, the second tab of
// My issues · All issues · Coalitions, folded to one row per category with one line per issue; an issue's page leads with
// its bills' week the way a coalition's page does, and keeps its editing tools behind "Edit bills" and Related's "Edit".
import { S, DB, SESSION_YEAR, SESSION_OVER, hooks, esc, advocate, fmtDate, fmtDT, effStage, STAGE_LABEL } from './data.js';
import { billById, billSay, billTag, plain, PUBLIC_APP, billRef, billByRef, billRoute, stopOf, riskOf, diedish, hearingAhead, whenAt } from './model.js';
import { teamFirst } from './model.js';   // R-316 W28
import { icon, btn, iconBtn, row, chip, empty, toast, openSheet, closeSheet, menuSheet, confirmSheet, switchRow, notice, posChip, pickerSheet, pickerChip, ownerOf, sectionNav } from './ui.js';
import { showAllBtn } from './ui.js';   // R-277 fix 4 (U-4): one "Show all" on every screen
import { plural, pageHead, afterClose, billName, isSide } from './lists.js';
import { convSectionHTML, wireConvSection } from './conversation.js';
import { FV_HREF, fvView, fvTitle, fvBack, renderFirstVisit, wireFirstVisit } from './firstvisit.js';
import { prepView, prepTitle, renderPrep, wirePrep, prepCardHTML, wirePrepCard, prepMenu, isDraft, stateOf, prepListHref } from './prep.js';
// Where an issue's Back goes (R-316 W16): to the prep list or the Prep board it was opened from, to My issues, else All issues.
const backTo = route => route.q?.from === 'prep' ? { href: prepListHref(), label: 'Your issues for 2027' } : route.q?.from === 'board' ? { href: '#/outreach/issues?view=prep', label: 'Prep board' }
  : route.q?.from === 'mine' ? { href: '#/my-issues', label: 'My issues' } : { href: '#/outreach/issues', label: 'All issues' };
import { testimonyOf, dueOf } from './hearing.js';
import { isPos, dayOf, dueWhen, waitingOfBills } from './standing.js';
import { weekOfBills, standWeekHTML, wireWeek } from './coalition.js';
import { standOf, bodyHTML, toolsHTML, wireTools } from './issuestand.js';

// ---- the catalogue ----
export const catByKey = k => (S.categories || []).find(c => c.key === k) || null;
export const issueById = id => (S.issues || []).find(i => String(i.id) === String(id)) || null;
const live = () => (S.issues || []).filter(i => !i.archived_at);
const byName = (a, b) => a.name.localeCompare(b.name);
const byNum = (a, b) => a.bill_number.localeCompare(b.bill_number, 'en', { numeric: true });
export const alsoIn = i => (S.issueCats || []).filter(x => x.issue_id === i.id && x.category !== i.category).map(x => x.category);
export const issuesOfBill = billId => { const on = new Set((S.billIssues || []).filter(x => x.bill_id === billId).map(x => x.issue_id)); return live().filter(i => on.has(i.id)).sort(byName); };
// A link from a bill to one of its issues names the bill (R-226): the issue's Back link then returns to that bill, and
// billFrom reads the name back from the address. Without it (the catalogue, a shared link) Back goes to Issues.
export const issueLinkHref = (i, b) => `#/issue/${encodeURIComponent(i.id)}?from=${encodeURIComponent(billRef(b))}`;
export const billFrom = route => { const ref = route?.q?.from; return ref ? billByRef(ref) || null : null; };
export const billsOn = i => (S.billIssues || []).filter(x => x.issue_id === i.id).map(x => billById(x.bill_id)).filter(Boolean);
const thisSession = b => !b.session_year || +b.session_year === +SESSION_YEAR;
// Whether a bill reaches the people who follow its issues: the database's own test (follow_set, 063).
export const whyNot = b => b.tracked === false ? 'No longer tracked, so its followers do not get it'
  : !b.is_public ? 'Not on the public page, so its followers do not get it'
  : !b.position || b.position === 'monitor' ? 'No position yet, so its followers do not get it' : '';
// Position bills this session that no issue carries: somebody following issues would never hear of them.
export const needsIssue = () => S.bills.filter(b => b.tracked !== false && b.position && b.position !== 'monitor' && thisSession(b) && !issuesOfBill(b.id).length)
  .sort((a, b) => (a.priority || 9) - (b.priority || 9) || byNum(a, b));
// Followers, from the supporters list (people_overview carries each person's issues and whole categories). Staff see
// every count; the public sees one only from 10 people. null until the list has loaded.
function followers(i) {
  if (!S.peopleLoaded) return null;
  const cats = new Set([i.category, ...alsoIn(i)]); let own = 0, via = 0;
  for (const p of S.people || []) { if ((p.issue_ids || []).includes(i.id)) own++; else if ((p.category_keys || []).some(k => cats.has(k))) via++; }
  return { own, via };
}
const wantPeople = () => { if (!S.peopleLoaded && !S.peopleLoading && !S.isPeopleTried) { S.isPeopleTried = true; DB.loadPeople().then(() => hooks.render()).catch(() => {}); } };
const catIcon = k => catByKey(k)?.icon || 'tag';
// In the first visit unless staff switched it off (066; an issue from before 066, or the sandbox's, has no value: on).
export const inFirstVisit = i => i?.first_visit !== false;
// Related issues (095, R-094): two issues whose bills are about the same thing. Someone following one is shown the
// other's bills first when they need voices (the public tracker's suggested bill). Found by the related-issues tool from
// the words their bills use (backend tools/issue_similarity.js, checked by Nate 9/30); a staff link or unlink here always
// wins and holds when the tool runs again.
const pairOf = (l, i) => l.issue_a === i.id ? l.issue_b : l.issue_b === i.id ? l.issue_a : null;
const choiceFor = (i, o) => (S.issueLinkChoices || []).find(c => pairOf(c, i) === o.id) || null;
export function relatedOf(i) {
  const found = new Set((S.issueLinks || []).map(l => pairOf(l, i)).filter(Boolean)), out = [], off = [];
  for (const o of live()) {
    if (o.id === i.id) continue;
    const c = choiceFor(i, o);
    if (c ? c.related : found.has(o.id)) out.push({ o, staff: !!c && c.related && !found.has(o.id) });
    else if (c && !c.related && found.has(o.id)) off.push({ o, c });
  }
  const sort = (x, y) => (x.o.category === i.category ? 0 : 1) - (y.o.category === i.category ? 0 : 1) || byName(x.o, y.o);
  return { on: out.sort(sort), off: off.sort(sort) };
}
// HIPHI's stance on the issue as a whole (094, R-093, Nate 9/29: "Editing an issue ... needs to allow us to change our
// stance ... also on the bill page"). Mixed: HIPHI backs some bills on it and opposes others. The public page says it on
// the issue ("HIPHI supports"); not set, it works it out from the bills, as it did before 094. An icon and a word, never
// colour alone (A-5). Set in Edit issue, from the chip on the issue's page, and from the issues on a bill's Public tab.
// Its own icons, never the thumbs a bill's position uses: on a bill page the two sit on one screen, and a staff member
// must not mistake the issue's chip for the bill's (the ui-critic review, 9/29).
export const STANCES = [['support', 'Support', 'circle-check', 'HIPHI is for it'], ['oppose', 'Oppose', 'circle-x', 'HIPHI is against it'],
  ['mixed', 'Mixed', 'scale', 'HIPHI supports some bills on it and opposes others']];
const stanceOf = i => STANCES.find(x => x[0] === i?.stance) || null;
// A quiet note when a bill on the issue has gone against the issue's stance (R-095, Nate 10/5, "Build it"): each bill keeps its own
// position, separate from the issue's stance (R-093), so "HIPHI supports" can sit over a bill HIPHI opposes, as the tax-cut bills on
// "Higher liquor taxes" do. Nothing changes by itself; the note lets staff decide whether the issue should become Mixed. Only this
// session's bills with a position that points the other way (neutral and Monitor do not); only for Support or Oppose.
const FOR = new Set(['strongly_support', 'support', 'support_amend']), AGAINST = new Set(['strongly_oppose', 'oppose']);
export const againstStance = (i, bills) => i?.stance === 'support' ? bills.filter(b => AGAINST.has(b.position)) : i?.stance === 'oppose' ? bills.filter(b => FOR.has(b.position)) : [];
function stanceNote(i, now) {
  const odd = againstStance(i, now); if (!odd.length || i.archived_at) return '';
  const word = i.stance === 'support' ? 'supports' : 'opposes', say = b => FOR.has(b.position) ? 'supports' : 'opposes';
  const list = odd.slice(0, 3).map(b => `<a href="${billRoute(b)}">${esc(billSay(b))}</a> (HIPHI ${say(b)} it)`).join(', ') + (odd.length > 3 ? ` and ${odd.length - 3} more` : '');
  return `<div class="is-stnote" role="note">${icon('info')}<div><p>${odd.length === 1 ? 'One bill on this issue goes' : `${odd.length} bills on this issue go`} against its stance, which says HIPHI ${word} it: ${list}. Each bill keeps its own position, and nothing has changed. If this is no longer the whole story, set the stance to Mixed.</p>${btn('Change the stance', { kind: 'text', sm: true, attrs: { 'data-is': 'stance' } })}</div></div>`;
}
// The picker chip that shows the stance and changes it; `a` carries its data attribute.
export const stanceChip = (i, a = {}) => { const s = stanceOf(i);
  return pickerChip(s ? s[1] : 'No stance', { 'aria-haspopup': 'dialog', 'aria-label': `HIPHI’s stance on ${i.name}: ${s ? s[1] : 'not set'}. Change`, ...a }, s ? s[2] : 'circle-dashed'); };
// Each pick saves at once and says so, with Undo (A-16, B-5). `after` redraws the screen it came from. From a bill page
// (`bill`), the sheet says it is the whole issue's stance and not that bill's position, where the choice is made.
export function pickStance(i, { after = () => hooks.render(), bill = null } = {}) {
  const n = billsOn(i).filter(thisSession).length;
  const help = bill ? `For the whole issue${n > 1 ? `, all ${n} of its bills` : ''}, not only ${esc(billSay(bill))}. It does not change ${esc(billSay(bill))}’s own position. The public page says it on the issue.`
    : 'The public page says it on the issue.';
  pickerSheet({ title: `HIPHI’s stance on ${esc(i.name)}`, value: i.stance || '', help,
    options: [...STANCES, ['', 'Not set', 'circle-dashed', 'The public page works it out from the bills']],
    onPick: async v => {
      const was = i.stance || null, now = v || null; if (was === now) return;
      try {
        await DB.updateIssue(i.id, { stance: now }); after();
        toast(now ? `HIPHI’s stance on ${i.name}: ${stanceOf(i)[1]}.` : `HIPHI’s stance on ${i.name}: not set.`, { undo: async () => { await DB.updateIssue(i.id, { stance: was }); after(); toast('Put back as it was'); } });
      } catch (e) { toast(e, { err: true }); after(); }
    } });
}

// ---- the issue form: New issue, and Edit on an issue's page ----
// With `bill`, a new issue is made for that bill and the bill goes on it.
export function openIssueForm(i = null, { bill = null } = {}) {
  const cats = S.categories || [], also = new Set(i ? alsoIn(i) : []), cur = i?.category || cats[0]?.key;
  const body = `<div class="le-sheet is-form">
    ${bill ? `<p class="small muted is-for">For ${esc(billSay(bill))}. It goes on the new issue.</p>` : ''}
    <div class="field"><label for="is-name">Name</label><input id="is-name" maxlength="60" autocomplete="off" value="${esc(i?.name || '')}" placeholder="Free school meals for every student" aria-describedby="is-name-h is-name-err">
      <span class="help" id="is-name-h">A policy people recognize, in everyday words. The public follows it by this name.</span><div id="is-name-err" role="alert"></div></div>
    <div class="field"><label for="is-desc">Description</label><textarea id="is-desc" rows="3" maxlength="240" aria-describedby="is-desc-h">${esc(i?.description || '')}</textarea>
      <span class="help" id="is-desc-h">One sentence on what would change. The public sees it.</span></div>
    <fieldset class="is-cats is-stance"><legend>HIPHI’s stance</legend><p class="help is-alsoh">The public page says it on the issue.</p>
      ${STANCES.map(([v, l, ic, sub]) => `<label class="check is-cat"><input type="radio" name="is-stance" value="${v}" ${v === (i?.stance || '') ? 'checked' : ''}><span class="is-catic">${icon(ic)}</span><span class="is-stw"><span>${l}</span><span class="is-sts">${sub}</span></span></label>`).join('')}</fieldset>
    ${i ? '' : `<div class="field"><label for="is-goal">HIPHI’s goal for 2027 <span class="is-opt">(can wait)</span></label><textarea id="is-goal" rows="2" maxlength="600" aria-describedby="is-goal-h"></textarea>
      <span class="help" id="is-goal-h">What we want to win on it. Staff only.</span></div>
    <div class="field"><label for="is-pts">Talking points <span class="is-opt">(can wait)</span></label><textarea id="is-pts" rows="4" maxlength="1100" placeholder="One plain sentence per line, three to five." aria-describedby="is-pts-h is-pts-err"></textarea>
      <span class="help" id="is-pts-h">For people’s testimony and emails. Each bill put on it starts with a copy. It is saved as a draft: the public sees it once it has a goal, three points and a bill, and an admin publishes it.</span><div id="is-pts-err" role="alert"></div></div>`}
    ${i ? `<div class="field"><label for="is-out">Between sessions</label><textarea id="is-out" rows="3" maxlength="300" aria-describedby="is-out-h">${esc(i.outlook || '')}</textarea>
      <span class="help" id="is-out-h">What happened last session and what to expect. The public page shows it from May to January, under the issue on Home and on its page. Claude drafted the first ones from the bills’ records; change anything, and add HIPHI’s plans.</span></div>` : ''}
    <fieldset class="is-cats"><legend>Category</legend>${cats.map(c => `<label class="check is-cat"><input type="radio" name="is-cat" value="${esc(c.key)}" ${c.key === cur ? 'checked' : ''}><span class="is-catic">${icon(c.icon || 'tag')}</span><span>${esc(c.name)}</span></label>`).join('')}</fieldset>
    <fieldset class="is-cats"><legend>Also in <span class="is-opt">(optional)</span></legend><p class="help is-alsoh">When it belongs to two, like the DUI limit: alcohol, and getting around safely.</p>
      ${cats.map(c => `<label class="check is-cat" data-also="${esc(c.key)}"${c.key === cur ? ' hidden' : ''}><input type="checkbox" name="is-also" value="${esc(c.key)}" ${also.has(c.key) ? 'checked' : ''}><span class="is-catic">${icon(c.icon || 'tag')}</span><span>${esc(c.name)}</span></label>`).join('')}</fieldset>
    ${switchRow('is-rec', 'Pre-tick for new visitors', !!i?.recommended, 'Silent: first-time visitors who pick its category find it already ticked. Nothing on the public page says it was recommended.')}
  </div>`;
  openSheet({ title: i ? 'Edit issue' : 'New issue', size: 'auto', body,
    foot: btn(i ? 'Save changes' : 'Save as draft', { icon: i ? 'check' : 'plus', attrs: { 'data-issave': '1' } }),
    wire: d => {
      const name = d.querySelector('#is-name'), go = d.querySelector('[data-issave]'), err = d.querySelector('#is-name-err');
      if (!i) name.focus();
      // An issue's own category is not also one of its extra ones.
      d.querySelectorAll('input[name="is-cat"]').forEach(r => r.onchange = () => d.querySelectorAll('[data-also]').forEach(l => { const own = l.dataset.also === r.value; l.hidden = own; if (own) l.querySelector('input').checked = false; }));
      name.oninput = () => { name.removeAttribute('aria-invalid'); err.innerHTML = ''; };
      const save = async () => {
        const nm = name.value.trim().replace(/\s+/g, ' '), description = d.querySelector('#is-desc').value.trim(), category = d.querySelector('input[name="is-cat"]:checked')?.value || cur;
        const extra = [...d.querySelectorAll('input[name="is-also"]:checked')].map(x => x.value).filter(k => k !== category), recommended = d.querySelector('#is-rec').checked;
        // Nothing is chosen for a new issue (B-12: never pre-select a stance); left unpicked it stays unset, and the public
        // page works it out from the bills. Not set is on the issue's chip.
        const stance = d.querySelector('input[name="is-stance"]:checked')?.value || (i ? i.stance || null : null);
        const clash = live().find(x => x.id !== i?.id && plain(x.name) === plain(nm));
        const bad = nm.length < 2 ? 'Give the issue a name.' : clash ? `There is already an issue called “${clash.name}”. Use that one, or merge them.` : '';
        if (bad) { name.setAttribute('aria-invalid', 'true'); err.innerHTML = `<span class="err">${icon('circle-alert')}${esc(bad)}</span>`; name.focus(); return; }
        go.setAttribute('aria-busy', 'true'); go.disabled = true;
        try {
          if (i) {
            // The outlook (079, R-067): saving a changed one marks it as a person's, so the draft tool never overwrites it.
            // A changed name, description or outlook counts as the owner's check of it (the prep, 091).
            const out = d.querySelector('#is-out')?.value.trim().replace(/\s+/g, ' ') || null, at = new Date().toISOString(), outPatch = out !== (i.outlook || null) ? { outlook: out, outlook_edited_at: at, outlook_checked_at: at } : {};
            const wordPatch = nm !== i.name || (description || null) !== (i.description || null) ? { wording_checked_at: at } : {};
            await DB.updateIssue(i.id, { name: nm, description: description || null, category, recommended, stance, ...outPatch, ...wordPatch });
            await DB.setIssueAlso(i.id, extra);
            closeSheet({ silent: true }); hooks.render(); toast('Saved. The public page shows the new wording.', { ok: true });
          } else {
            const goal = d.querySelector('#is-goal').value.trim(), pts = d.querySelector('#is-pts').value.split('\n').map(x => x.trim().replace(/^[-•*]\s*/, '')).filter(Boolean);
            const ptBad = pts.length > 5 ? 'Five points at most.' : pts.some(x => x.length > 200) ? 'Keep each point under 200 characters.' : '';
            if (ptBad) { d.querySelector('#is-pts-err').innerHTML = `<span class="err">${icon('circle-alert')}${esc(ptBad)}</span>`; d.querySelector('#is-pts').focus(); go.removeAttribute('aria-busy'); go.disabled = false; return; }
            const ni = await DB.createIssue({ name: nm, description, category, also: extra, recommended, goal, talking_points: pts, stance });
            if (bill) await DB.setBillIssue(bill.id, ni.id, true);
            closeSheet({ silent: true }); await afterClose();
            // Straight to the new issue either way: its card says what it still needs before an admin can publish it.
            S.go('#/issue/' + encodeURIComponent(ni.id));
            toast(bill ? `Saved ${ni.name} as a draft with ${billSay(bill)} on it. The public sees it once it is published.` : 'Saved as a draft. Put its bills on it below.', { ok: true });
          }
        } catch (e) { toast(e, { err: true }); go.removeAttribute('aria-busy'); go.disabled = false; }
      };
      go.onclick = save;
      name.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); save(); } };
    } });
}

// ---- which issues a bill is on: a sheet with every issue, by category; each tap saves ----
export function openIssuePicker(b, { onClose = () => hooks.render() } = {}) {
  let q = '';
  const list = () => {
    const on = new Set(issuesOfBill(b.id).map(i => i.id)), t = plain(q.trim());
    const hit = i => !t || plain(`${i.name} ${i.description || ''}`).includes(t);
    const item = i => `<button type="button" role="checkbox" aria-checked="${on.has(i.id)}" data-pick="${esc(i.id)}">${icon(on.has(i.id) ? 'square-check-big' : 'square', { cls: on.has(i.id) ? 'on' : '' })}<span class="body"><span class="title">${esc(i.name)}</span>${isDraft(i) ? '<span class="sub">Draft: not public yet</span>' : i.description ? `<span class="sub">${esc(i.description)}</span>` : ''}</span></button>`;
    const mine = live().filter(i => on.has(i.id) && hit(i)).sort(byName);
    const groups = (S.categories || []).map(c => [c, live().filter(i => i.category === c.key && !on.has(i.id) && hit(i)).sort(byName)]).filter(([, l]) => l.length);
    if (!mine.length && !groups.length) return `<p class="le-none">No issue matches “${esc(q.trim())}”. Make a new one below.</p>`;
    return `${mine.length ? `<h3 class="is-gh">On this bill</h3><div class="sv-pickl">${mine.map(item).join('')}</div>` : ''}
      ${groups.map(([c, l]) => `<h3 class="is-gh">${icon(c.icon || 'tag')}${esc(c.name)}</h3><div class="sv-pickl">${l.map(item).join('')}</div>`).join('')}`;
  };
  const reach = whyNot(b);
  openSheet({ title: `Issues for ${esc(billSay(b))}`,
    body: `<div class="is-picker"><p class="small muted is-for">Everyone who follows a ticked issue gets this bill${reach ? ` once it has a position and is public (${esc(reach.split(',')[0].toLowerCase())} now)` : ''}. Each tap saves.</p>
      <div class="le-search is-psearch">${icon('search')}<input id="is-pq" type="search" placeholder="Find an issue" autocomplete="off" aria-label="Find an issue" aria-controls="is-plist"></div>
      <div id="is-plist" class="is-plist">${list()}</div></div>`,
    foot: btn('New issue for this bill', { kind: 'secondary', icon: 'plus', attrs: { 'data-isnew': '1' } }),
    onClose,
    wire: d => {
      const box = d.querySelector('#is-plist');
      const wireList = () => box.querySelectorAll('[data-pick]').forEach(el => el.onclick = async () => {
        const i = issueById(el.dataset.pick), on = el.getAttribute('aria-checked') !== 'true'; if (!i) return;
        el.disabled = true;
        try { await DB.setBillIssue(b.id, i.id, on); box.innerHTML = list(); wireList(); box.querySelector(`[data-pick="${CSS.escape(i.id)}"]`)?.focus(); toast(on ? `Put on ${i.name}.` : `Taken off ${i.name}.`); }
        catch (e) { el.disabled = false; toast(e, { err: true }); }
      });
      wireList();
      d.querySelector('#is-pq').oninput = e => { q = e.target.value; box.innerHTML = list(); wireList(); };
      d.querySelector('[data-isnew]').onclick = async () => { closeSheet({ silent: true }); await afterClose(); openIssueForm(null, { bill: b }); };
    } });
}

// ---- the index: All issues ----
// v3 (R-264): one row per category, each opened on a click and one open at a time (the four laptop rules: one thing open,
// one line per item). An issue's row is its name and, where it applies, one state; its bills, followers and description
// are on its own page. The count beside a category says how many issues have a hearing this week, the one number here
// that asks for something. A search shows every match at once, by category.
const V = () => S.isIdx ??= { q: '', needsAll: false, open: null };
const hearsNow = i => weekOfBills(billsOn(i).filter(b => thisSession(b) && b.tracked !== false)).length > 0;
function issueRow(i) {
  // Left out of the first visit: a quiet grey mark, which also stands in for "Pre-ticked" (a pre-tick does nothing then).
  const mark = isDraft(i) ? chip('Draft', '', 'eye-off') : !inFirstVisit(i) && !i.archived_at ? chip('Not in first visit', '', 'eye-off') : i.recommended ? chip('Pre-ticked', '', 'star') : '';
  const hear = !i.archived_at && hearsNow(i) ? `<span class="is-hw">${icon('calendar-days')}<span>Hearing this week</span></span>` : '';
  return row({ title: esc(i.name), end: `${hear}${mark}`, href: '#/issue/' + encodeURIComponent(i.id), cls: 'is-row' });
}
function needsHTML(v) {
  const need = needsIssue(); if (!need.length) return '';
  const shown = v.needsAll ? need : need.slice(0, 5);
  return `<section class="card is-needs" aria-labelledby="is-nh">
    <h2 id="is-nh">${icon('triangle-alert')}<span>${plural(need.length, 'position bill')} this session with no issue</span></h2>
    <p class="small">Nobody following issues gets ${need.length === 1 ? 'it' : 'these'}. Put each one on an issue.</p>
    <ul class="rows is-nlist">${shown.map(b => `<li class="is-nrow"><a class="is-nmain" href="${billRoute(b, 'public')}">${billName(b, 90)}</a>${btn('Choose', { kind: 'secondary', sm: true, attrs: { 'data-ispick': b.id, 'aria-haspopup': 'dialog', 'aria-label': `Choose issues for ${billSay(b)}` } })}</li>`).join('')}</ul>
    ${need.length > shown.length ? showAllBtn(need.length, { 'data-is': 'needsall' }) : ''}
  </section>`;
}
// R-272: the same body as My issues (issuestand.js): By deadline by default, By topic with the switch (the topics folded,
// one open at a time, each counting its issues at risk, with a bill dying and with a hearing this week), and a search that
// matches any word a person would use. Archived issues wait in their fold, matched by name only.
function indexBody(v) {
  const t = plain(v.q.trim()), gone = (S.issues || []).filter(i => i.archived_at && (!t || plain(`${i.name} ${i.description || ''}`).includes(t))).sort(byName);
  const arch = gone.length ? `<details class="is-arch"><summary>${icon('archive')}<span>Archived (${gone.length})</span>${icon('chevron-down', { cls: 'is-chev' })}</summary><div class="rows">${gone.map(issueRow).join('')}</div></details>` : '';
  const list = live().map(standOf), tagsOf = x => [isDraft(x.i) ? 'Draft' : '', !inFirstVisit(x.i) ? 'Not in first visit' : ''].filter(Boolean);
  return `${bodyHTML(list, { q: v.q, folded: true, open: v.open, tagsOf })}${arch}`;
}
// The "…" beside New issue: the first visit's numbers and links, and the 2027 prep (prep.js prepMenu: your issues between
// sessions, as My issues shows them since R-263, and the admins' board).
function indexMenu() {
  menuSheet({ title: 'All issues', items: [
    { label: 'First visit: numbers and links', icon: 'footprints', sub: 'How newcomers use it, and a link to share', run: () => S.go(FV_HREF) },
    ...prepMenu({ mine: SESSION_OVER }),
  ] });
}
// First visit (?view=first-visit) and Make a link (?view=links) are views of this screen (firstvisit.js), so the frame's
// router needs no new route. Make a link is a form, so it is a reading column on a desktop.
const index = {
  tab: 'myissues',   // v3: All issues is the second tab of My issues
  title: route => prepTitle(route) || fvTitle(route) || 'All issues',
  back: route => prepView(route) === 'mine' ? { href: '#/my-issues', label: 'My issues' } : prepView(route) ? { href: '#/outreach/issues', label: 'All issues' } : fvBack(route),
  // The index itself is a reading column (a row per category reads badly 1,600px wide); the prep board keeps the width.
  wide: route => !!prepView(route),
  narrow: route => fvView(route) === 'links',
  render(route) {
    if (prepView(route)) return renderPrep(route);
    if (fvView(route)) return renderFirstVisit(route);
    wantPeople();
    const v = V();
    const acts = `${btn('New issue', { icon: 'plus', attrs: { 'data-is': 'new', 'aria-haspopup': 'dialog' } })}${iconBtn('ellipsis', 'More: the first visit, and getting ready for 2027', { 'data-is': 'idxmore', 'aria-haspopup': 'dialog' })}`;
    const nav = sectionNav('issues', 'all');
    if (!(S.categories || []).length) return `<div class="le-page is-index">${pageHead(nav, 'All issues', '', '')}<div class="le-empty">${empty({ title: 'Issues are not set up yet', text: 'They arrive with migration 063. Ask Claude to load the list.' })}</div></div>`;
    return `<div class="le-page is-index ist-page">
      ${pageHead(nav, 'All issues', '', `<span class="is-acts">${acts}</span>`)}
      ${needsHTML(v)}
      ${toolsHTML(v.q, 'is-q')}
      <div id="is-q-body">${indexBody(v)}</div>
    </div>`;
  },
  wire(route, root) {
    if (prepView(route)) return wirePrep(route, root);
    if (fvView(route)) return wireFirstVisit(route, root);
    const v = V();
    root.querySelectorAll('[data-is="new"]').forEach(el => el.onclick = () => openIssueForm());
    root.querySelector('[data-is="idxmore"]')?.addEventListener('click', indexMenu);
    root.querySelector('[data-is="needsall"]')?.addEventListener('click', () => { v.needsAll = true; hooks.render(); });
    root.querySelectorAll('[data-ispick]').forEach(el => el.onclick = () => { const b = billById(el.dataset.ispick); if (b) openIssuePicker(b); });
    const body = root.querySelector('#is-q-body');
    // One category open at a time: opening one closes the one before, and the page remembers which for this visit.
    const wireCats = () => body.querySelectorAll('.is-catf').forEach(d => d.addEventListener('toggle', () => {
      if (d.open) { v.open = d.dataset.cat; body.querySelectorAll('.is-catf[open]').forEach(o => { if (o !== d) o.open = false; }); }
      else if (v.open === d.dataset.cat) v.open = null;
    }));
    const paint = () => { body.innerHTML = indexBody(v); wireCats(); };
    wireCats();
    wireTools(root, 'is-q', { get: () => v.q, set: x => { v.q = x; }, paint });
  },
};
export default index;

// ---- one issue ----
const P = () => S.isPage ??= { q: {}, edit: {}, rel: {} };
function hits(i, q) {
  const t = plain(q.trim()), tn = t.replace(/\s+/g, ''); if (t.length < 2) return [];
  const on = new Set(billsOn(i).map(b => b.id)), pool = S.bills.filter(b => b.tracked !== false && !on.has(b.id));
  const num = pool.filter(b => b.bill_number.toLowerCase().includes(tn)), words = pool.filter(b => !num.includes(b) && [b.nickname, b.title, b.public_summary, b.description].some(x => plain(x).includes(t)));
  // Bills that would reach followers first: a position, this session.
  const rank = b => (b.position && b.position !== 'monitor' ? 0 : 2) + (thisSession(b) ? 0 : 1);
  return [...num, ...words].sort((a, b) => rank(a) - rank(b)).slice(0, 8);
}
function hitsHTML(i, q) {
  if (q.trim().length < 2) return '';
  const rows = hits(i, q);
  if (!rows.length) return `<p class="le-none">No tracked bill matches “${esc(q.trim())}”.</p>`;
  return `<div class="rows le-hits" role="listbox" id="is-hitlist" aria-label="Tracked bills that match">${rows.map((b, k) => `<div class="row le-hit" role="option" id="is-hit-${k}" aria-selected="false" data-add="${esc(b.id)}"><span class="le-plus">${icon('plus')}</span><span class="body">${billName(b, 90)}</span></div>`).join('')}</div>`;
}
// The deadline's words, as the coalition and Today say them: "14 days left", "last day today"; and its day, "Mon 3/30".
const leftWord = dl => dl.days <= 0 ? 'last day today' : `${dl.days} day${dl.days === 1 ? '' : 's'} left`;
const dayAt = d => dayOf(d + 'T12:00:00-10:00');
// A bill's line on this issue's page (R-226): where it stands in one line, in the words the bill page uses (its stage, the
// committee, the next hearing or the deadline with the days left, the testimony for that hearing, and the owner). Built
// from the same helpers as the bill page, Today and the coalition page, so the line cannot disagree with them.
// `owner: 'others'` (My issues, R-263): the issue is already yours there, so only a bill someone else holds names them.
export function standLine(b, { owner = 'all' } = {}) {
  if (diedish(b)) return 'Did not advance';
  const st = stopOf(b), h = hearingAhead(b), parts = [STAGE_LABEL[effStage(b)] || ''];
  if (h) {
    parts.push(`Hearing ${whenAt(h.scheduled_at)}${h.committee ? ` · ${h.committee}` : ''}`);
    // Testimony for that hearing, in the hearing page's words: due (not started), drafted or filed.
    if (isPos(b)) { const t = testimonyOf(h, b); parts.push(t.filed ? 'Testimony filed' : t.word === 'not started' ? `Testimony due ${dueWhen(dueOf(h))}` : 'Testimony drafted'); }
  } else if (st.deadline?.missed) parts.push(`Missed the ${st.deadline.label} deadline`);
  else if (st.phase === 'committee' && st.deadline) {
    const lead = riskOf(b) ? 'At risk: needs' : 'Needs';
    parts.push(`${lead} a hearing${st.committee ? ` in ${st.committee}` : ''} by ${dayAt(st.deadline.date)}, ${leftWord(st.deadline)}`);
  } else if (st.deadline) parts.push(`${st.deadline.label} ${dayAt(st.deadline.date)}, ${leftWord(st.deadline)}`);
  else if (st.committee) parts.push(`In ${st.committee}`);
  const who = ownerOf(b);
  // R-316 W28 (G3-8): an owner who is turned off says so (model.js teamFirst).
  if (owner === 'others') { if (who && who.id !== S.me?.id) parts.push(`Owner: ${teamFirst(who)}`); }
  else parts.push(who ? `Owner: ${who.id === S.me?.id ? 'You' : teamFirst(who)}` : 'No owner');
  return parts.filter(Boolean).join(' · ');
}
// A bill's row on the issue's page (v3, one line): its number and name, then its stage and HIPHI's position. Where it
// stands this week is said once, in the week above; a bill whose followers do not get it says why, under its name.
// The × to take it off shows only while editing the bills.
// R-271: the nickname leads, the number follows small; a bill with no nickname keeps number then summary.
const rowName = b => billTag(b, 110);
// The same facts as one short phrase, for a row that has room for one (My issues, v3): the hearing and its testimony, or
// what the bill needs and by when, or where it waits; its stage only when nothing says more. The owner is named only when
// it is someone else (R-263). Built from standLine's helpers, so the two cannot disagree.
// The testimony's own state in the word list's words (C-15: "ready to file", "in review", "sent back"), the same as This
// week and the hearing page say it; it read "testimony drafted" for every state between started and filed.
export const testimonyWords = (h, b) => { const t = testimonyOf(h, b); return t.filed ? 'testimony filed' : t.word === 'not started' ? `testimony due ${dueWhen(dueOf(h))}` : `testimony ${t.word}`; };
export function nextPhrase(b) {
  let say;
  if (diedish(b)) say = 'Did not advance';
  else {
    const st = stopOf(b), h = hearingAhead(b);
    if (h) say = `Hearing ${whenAt(h.scheduled_at)}${isPos(b) ? ` · ${testimonyWords(h, b)}` : ''}`;
    else if (st.deadline?.missed) say = `Missed the ${st.deadline.label} deadline`;
    else if (st.phase === 'committee' && st.deadline) say = `${riskOf(b) ? 'At risk: needs' : 'Needs'} a hearing${st.committee ? ` in ${st.committee}` : ''} by ${dayAt(st.deadline.date)}`;
    else if (st.deadline) say = `${st.deadline.label} ${dayAt(st.deadline.date)}`;
    else say = st.committee ? `In ${st.committee}` : STAGE_LABEL[effStage(b)] || '';
  }
  const who = ownerOf(b);
  return who && who.id !== S.me?.id ? `${say} · Owner: ${teamFirst(who)}` : say;
}
function billLine(i, b, edit) {
  const why = whyNot(b), stage = diedish(b) ? 'Did not advance' : thisSession(b) ? STAGE_LABEL[effStage(b)] || '' : String(b.session_year || '');
  return `<li class="le-brow is-brow" data-bid="${esc(b.id)}">
    <a class="le-bmain" href="${billRoute(b)}"><span class="title is-bt">${rowName(b)}</span>${why ? `<span class="le-warn">${icon('eye-off')}${esc(why)}</span>` : ''}</a>
    <span class="is-bend"><span class="is-bstage">${esc(stage)}</span>${posChip(b.position || '')}</span>
    ${edit ? iconBtn('x', `Take ${billSay(b)} off ${i.name}`, { 'data-isrm': b.id }) : ''}
  </li>`;
}
// Where its bills stand this week, the coalition page's way (R-226, v3): the hearings this week with the testimony and
// who is going, the bills at risk, the ones racing the next deadline (coalition.js standWeekHTML). Between sessions it is
// one line, as Today says it, rather than empty sections.
function weekHTML(i, now) {
  if (SESSION_OVER) return `<section class="le-sec is-stand" aria-labelledby="is-sth"><div class="le-sechead"><h2 id="is-sth">Where it stands</h2></div>
    <p class="small muted is-sone">Between sessions: hearings and deadlines come back when the next session opens.</p></section>`;
  const going = now.filter(b => b.tracked !== false);
  if (!going.length || i.archived_at) return '';
  return `<div class="is-week">${standWeekHTML(going, { key: 'is' + i.id })}</div>`;
}
// The bills, one line each; in session the ones that did not advance wait in one quiet fold (as on My issues), and
// earlier sessions' in another. "Edit bills" opens the tools under them: the search that puts a bill on the issue, and
// the × on each row. An issue with no bills yet starts with the search open.
// A bill the week above already lists (its hearing this week, at risk, racing the next deadline) is not listed again
// under Bills (A-14: the fresh-eyes review found HB1779 twice, with two different statuses); "Edit bills" shows them all.
function shownAbove(list) {
  if (SESSION_OVER) return new Set();
  const w = waitingOfBills(list);
  return new Set([...weekOfBills(list).flatMap(x => x.rows.map(h => h.bill_id)), ...w.risk.map(x => x.b.id), ...w.race.map(x => x.b.id)]);
}
function billsHTML(i, now, earlier) {
  const st = P(), q = st.q[i.id] || '', edit = !!st.edit[i.id] || !(now.length + earlier.length);
  const above = edit ? new Set() : shownAbove(now.filter(b => b.tracked !== false));
  const moving = (SESSION_OVER ? now : now.filter(b => !diedish(b))).filter(b => !above.has(b.id)), gone = SESSION_OVER ? [] : now.filter(diedish);
  const add = `<div class="le-add is-add">
      <label class="sr" for="is-bq">Put a bill on this issue: number or words</label>
      <div class="le-search">${icon('search')}<input id="is-bq" type="search" role="combobox" aria-expanded="false" aria-autocomplete="list" placeholder="Put a bill on it: number or words" value="${esc(q)}" autocomplete="off" enterkeyhint="search" aria-controls="is-hits">${iconBtn('x', 'Clear the search', { 'data-is': 'bqclear', hidden: !q })}</div>
      <div id="is-hits">${hitsHTML(i, q)}</div>
      <p class="sr" id="is-hitn" role="status"></p>
    </div>`;
  const fold = (cls, ic, label, list) => list.length ? `<details class="${cls}"${edit ? ' open' : ''}><summary>${icon(ic, { cls: 'is-chev' })}<span>${label}</span></summary><ol class="rows le-bills">${list.map(b => billLine(i, b, edit)).join('')}</ol></details>` : '';
  return `<section class="le-sec is-bills" aria-labelledby="is-bh">
      <div class="le-sechead"><h2 id="is-bh">${above.size ? 'Other bills' : 'Bills'}</h2></div>
      ${moving.length ? `<ol class="rows le-bills">${moving.map(b => billLine(i, b, edit)).join('')}</ol>`
        : now.length ? '' : `<p class="le-none">No ${esc(SESSION_YEAR)} bills on it yet.</p>`}
      ${fold('is-gone', 'chevron-down', `${gone.length} did not advance`, gone)}
      ${fold('is-gone', 'history', `Earlier sessions (${earlier.length})`, earlier)}
      ${edit ? add : ''}
      ${now.length + earlier.length ? `<div class="is-editrow">${btn(edit ? 'Done' : 'Edit bills', { kind: 'text', sm: true, icon: edit ? 'check' : 'pencil', attrs: { 'data-is': 'editbills', 'aria-expanded': String(edit) } })}</div>` : ''}
    </section>`;
}
// Followers and the first-visit switch: what the public side of the issue is. Its public page is in the ⋯ menu (said once).
function publicCard(i) {
  if (isDraft(i)) return '';
  const f = followers(i);
  const fol = !f ? '<span class="meta">Counting followers…</span>'
    : `<span class="le-fol">${icon('users')}<span>${f.own ? plural(f.own, 'person follows', 'people follow') + ' it' : 'Nobody follows it on its own yet'}${f.via ? `; ${plural(f.via, 'more person gets', 'more people get')} it with a whole category` : ''}</span></span>`;
  return `<section class="card is-folcard" aria-labelledby="is-ph"><h2 id="is-ph">On the public page</h2>
    <p class="is-fol">${fol}</p>
    ${i.archived_at ? '' : switchRow('is-fv', 'Show in the first visit', inFirstVisit(i), inFirstVisit(i) ? 'Newcomers can follow it on their first visit.' : 'Left out of a newcomer’s first visit. People can still find and follow it.')}</section>`;
}
function pageRender(route) {
  const i = issueById(route.id);
  if (!i) return `<div class="le-page le-list">${empty({ h: 'h1', title: 'This issue is not here', text: 'It may have been merged into another, or the link is old.', action: btn('See all issues', { href: '#/outreach/issues' }) })}</div>`;
  wantPeople();
  const c = catByKey(i.category), also = alsoIn(i).map(catByKey).filter(Boolean), bills = billsOn(i).sort(byNum), now = bills.filter(thisSession), earlier = bills.filter(b => !thisSession(b));
  // Opened from a bill, Back returns to that bill and says so (R-226); from My issues, there; else All issues.
  const from = billFrom(route), side = isSide();
  // The outlook is what the public reads between sessions: in the header then, and in session inside the 2027 card (v3).
  const outlook = i.outlook ? `<p class="le-ldesc is-outlook"><span class="meta">Between sessions, the public sees: </span>${esc(i.outlook)}</p>` : '';
  const head = `<header class="le-lhead">
      <span class="le-licon">${icon(c?.icon || 'tag')}</span>
      <div class="le-lhbody"><h1>${esc(i.name)}</h1>
        ${i.description ? `<p class="le-ldesc">${esc(i.description)}</p>` : ''}
        ${SESSION_OVER ? outlook : (i.goal || '').trim() ? `<p class="le-ldesc is-goal"><span class="meta">Our ${esc(SESSION_YEAR)} goal, staff only: </span>${esc(i.goal)}</p>` : ''}
        <div class="is-stline"><span class="is-stl">HIPHI’s stance</span>${stanceChip(i, { 'data-is': 'stance' })}</div>
        ${stanceNote(i, now)}
        <p class="meta">${esc(c?.name || i.category)}${also.length ? ` · also in ${esc(also.map(x => x.name).join(' and '))}` : ''}${i.recommended ? ' · Pre-ticked for new visitors' : ''}</p></div>
      ${iconBtn('ellipsis', `More for ${i.name}`, { 'data-is': 'more', 'aria-haspopup': 'dialog' }, 'le-hmore')}
    </header>
    ${i.archived_at ? notice('warn', 'archive', '<b>Archived.</b> The public does not see it, and its followers do not get its bills.', btn('Restore', { kind: 'secondary', sm: true, attrs: { 'data-is': 'restore' } })) : ''}`;
  // R-316 W16: between sessions the 2027 prep is the work, so its card comes first (Mark ready sat below the screen on all
  // 28 of Lauren's issues); once approved it folds and goes back under the bills.
  const prep = prepCardHTML(i, { outlook: SESSION_OVER ? '' : outlook }), prepFirst = SESSION_OVER && !isDraft(i) && !i.archived_at && stateOf(i) !== 'approved';
  const work = prepFirst ? `${prep}${weekHTML(i, now)}${billsHTML(i, now, earlier)}` : `${weekHTML(i, now)}${billsHTML(i, now, earlier)}${prep}`;
  const bk = backTo(route);
  const aside = `${publicCard(i)}${i.archived_at ? '' : relatedHTML(i)}`;
  const back = `<a class="le-deskback" href="${from ? billRoute(from) : bk.href}" data-back${from ? ` aria-label="Back to ${esc(from.bill_number)}"` : ''}>${icon('chevron-left')}<span>${from ? `Back to ${esc(from.bill_number)}` : esc(bk.label)}</span></a>`;
  // A laptop: the issue and its week on the left; its public side and related issues in the one side panel (as a
  // coalition's page keeps sharing and support there). A phone reads it all in one column, the work first.
  if (side) return `<div class="le-page le-list is-page is-two">${back}<div class="sv-cols is-cols">
      <div class="is-main">${head}${work}${convSectionHTML(convOpts(i))}</div>
      <aside class="sv-aside is-side" aria-label="On the public page, and related issues">${aside}</aside></div></div>`;
  return `<div class="le-page le-list is-page">${back}${head}${work}${aside}${convSectionHTML(convOpts(i))}</div>`;
}
// A link works both ways: unlinking here unlinks it on the other issue's page too. Each row is the other issue's name,
// with its category when it is another one and "Linked by staff" for the links nobody's wording found. The × on each,
// "Link another issue" and the ones staff unlinked show while editing (v3: one label instead of the paragraph).
function relatedHTML(i) {
  const { on, off } = relatedOf(i), edit = !!P().rel[i.id];
  const line = (o, sub, act) => `<li class="le-brow"><a class="le-bmain" href="#/issue/${encodeURIComponent(o.id)}"><span class="title"><b class="le-nick">${esc(o.name)}</b></span>
      ${sub ? `<span class="sub le-bsum">${esc(sub)}</span>` : ''}</a>${act}</li>`;
  const about = (o, staff) => [o.category === i.category ? '' : catByKey(o.category)?.name || o.category, staff ? 'Linked by staff' : ''].filter(Boolean).join(' · ');
  const who = c => { const a = c.set_by && advocate(c.set_by); return `Unlinked${a ? ` by ${a.initials}` : ''}${c.set_at ? `, ${fmtDate(c.set_at)}` : ''}`; };
  return `<section class="le-sec is-rel" aria-labelledby="is-rh">
    <div class="le-sechead"><h2 id="is-rh">Related issues</h2>${btn(edit ? 'Done' : 'Edit', { kind: 'text', sm: true, attrs: { 'data-is': 'reledit', 'aria-expanded': String(edit), 'aria-label': edit ? 'Done editing related issues' : 'Edit related issues' } })}</div>
    <p class="meta is-rell">Followers of either one see the other’s bills first</p>
    ${on.length ? `<ol class="rows le-bills">${on.map(({ o, staff }) => line(o, about(o, staff), edit ? iconBtn('x', `Unlink ${o.name} from ${i.name}`, { 'data-isunlink': o.id }) : '')).join('')}</ol>`
      : '<p class="le-none">None yet.</p>'}
    ${edit ? `<div class="btnrow">${btn('Link another issue', { kind: 'secondary', sm: true, icon: 'link', attrs: { 'data-is': 'link' } })}</div>
    ${off.length ? `<details class="is-arch"><summary>${icon('eye-off')}<span>Unlinked by staff (${off.length})</span>${icon('chevron-down', { cls: 'is-chev' })}</summary>
      <ol class="rows le-bills">${off.map(({ o, c }) => line(o, `${about(o)}${about(o) ? ' · ' : ''}${who(c)}`,
        btn('Link again', { kind: 'text', sm: true, attrs: { 'data-isrelink': o.id } }))).join('')}</ol></details>` : ''}` : ''}
  </section>`;
}
async function setLink(i, o, on) {
  const redraw = () => { const y = scrollY; hooks.render(); if (Math.abs(scrollY - y) > 1) scrollTo(0, y); document.getElementById('is-rh')?.closest('section')?.querySelector('[data-is="link"]')?.focus({ preventScroll: true }); };
  try {
    await DB.setIssueLink(i.id, o.id, on); redraw();
    toast(on ? `Linked ${o.name} and ${i.name}.` : `Unlinked ${o.name} and ${i.name}.`, { ok: on, undo: async () => { await DB.setIssueLink(i.id, o.id, !on); redraw(); } });
  } catch (e) { toast(e, { err: true }); }
}
function linkSheet(i) {
  let q = '';
  const have = new Set(relatedOf(i).on.map(x => x.o.id));
  const list = () => { const t = plain(q.trim()); const l = live().filter(x => x.id !== i.id && !have.has(x.id) && (!t || plain(x.name).includes(t)))
      .sort((a, b) => (a.category === i.category ? 0 : 1) - (b.category === i.category ? 0 : 1) || byName(a, b)).slice(0, 30);
    return l.length ? `<div class="sv-pickl">${l.map(x => `<button type="button" data-linkto="${esc(x.id)}">${icon(catIcon(x.category))}<span class="body"><span class="title">${esc(x.name)}</span><span class="sub">${esc(catByKey(x.category)?.name || '')} · ${plural(billsOn(x).length, 'bill')}</span></span></button>`).join('')}</div>` : '<p class="le-none">No other issue matches.</p>'; };
  openSheet({ title: `Link to ${esc(i.name)}`, pop: true,
    body: `<p class="small muted is-for">Pick an issue whose bills are about the same thing. When we ask people to act, anyone following either one is shown the other’s bills first.</p>
      <div class="le-search is-psearch">${icon('search')}<input id="is-lq" type="search" placeholder="Find the issue" autocomplete="off" aria-label="Find the issue to link"></div><div id="is-llist">${list()}</div>`,
    wire: d => {
      const box = d.querySelector('#is-llist');
      const wireList = () => box.querySelectorAll('[data-linkto]').forEach(el => el.onclick = async () => {
        const o = issueById(el.dataset.linkto); if (!o) return;
        await closeSheet({ silent: true }); await afterClose(); setLink(i, o, true);
      });
      wireList();
      d.querySelector('#is-lq').oninput = e => { q = e.target.value; box.innerHTML = list(); wireList(); };
    } });
}
// Conversations with legislators filed under this issue, from any of its bills or a legislator's page (R-022 wave 2 #9,
// conversation.js): an issue carries across sessions where a bill does not.
const convOpts = i => ({ id: 'is-cv', q: { issueIds: [i.id] }, here: { issueId: i.id }, kind: 'le', limit: 5, log: { issueId: i.id },
  none: 'None logged yet. A conversation logged under this issue, from any of its bills or a legislator’s page, shows here.' });
async function takeOff(i, b) {
  try {
    await DB.setBillIssue(b.id, i.id, false); hooks.render();
    toast(`Took ${billSay(b)} off ${i.name}.`, { undo: async () => { await DB.setBillIssue(b.id, i.id, true); hooks.render(); } });
  } catch (e) { toast(e, { err: true }); }
}
async function putOn(i, b) {
  try {
    await DB.setBillIssue(b.id, i.id, true); P().q[i.id] = ''; hooks.render();
    document.getElementById('is-bq')?.focus();
    const why = whyNot(b);
    toast(`Put ${billSay(b)} on ${i.name}.${why ? ` ${why.split(',')[0]}, so followers get it once that changes.` : ''}`, { ok: !why, undo: async () => { await DB.setBillIssue(b.id, i.id, false); hooks.render(); } });
  } catch (e) { toast(e, { err: true }); }
}
function mergeSheet(i) {
  let q = '';
  const list = () => { const t = plain(q.trim()); const l = live().filter(x => x.id !== i.id && (!t || plain(x.name).includes(t))).sort((a, b) => (a.category === i.category ? 0 : 1) - (b.category === i.category ? 0 : 1) || byName(a, b)).slice(0, 30);
    return l.length ? `<div class="sv-pickl">${l.map(x => `<button type="button" data-into="${esc(x.id)}">${icon(catIcon(x.category))}<span class="body"><span class="title">${esc(x.name)}</span><span class="sub">${esc(catByKey(x.category)?.name || '')} · ${plural(billsOn(x).length, 'bill')}</span></span></button>`).join('')}</div>` : '<p class="le-none">No other issue matches.</p>'; };
  openSheet({ title: `Merge ${esc(i.name)} into…`, pop: true,
    body: `<p class="small muted is-for">Pick the issue to keep. ${esc(i.name)}’s bills and followers move to it, and ${esc(i.name)} is archived. Nobody loses a bill.</p>
      <div class="le-search is-psearch">${icon('search')}<input id="is-mq" type="search" placeholder="Find the issue to keep" autocomplete="off" aria-label="Find the issue to keep"></div><div id="is-mlist">${list()}</div>`,
    wire: d => {
      const box = d.querySelector('#is-mlist');
      const wireList = () => box.querySelectorAll('[data-into]').forEach(el => el.onclick = async () => {
        const into = issueById(el.dataset.into); if (!into) return;
        await closeSheet({ silent: true }); await afterClose();
        const n = billsOn(i).length, f = followers(i);
        const ok = await confirmSheet({ title: `Merge into ${esc(into.name)}?`, ok: 'Merge', danger: true,
          text: `${esc(i.name)}’s ${plural(n, 'bill')}${f && f.own ? ` and ${plural(f.own, 'follower')}` : ''} move to ${esc(into.name)}, and ${esc(i.name)} is archived. A merge cannot be undone from here.` });
        if (!ok) return;
        try { await DB.mergeIssues(i.id, into.id); S.go('#/issue/' + encodeURIComponent(into.id), { replace: true }); toast(`Merged into ${into.name}.`, { ok: true }); }
        catch (e) { toast(e, { err: true }); }
      });
      wireList();
      d.querySelector('#is-mq').oninput = e => { q = e.target.value; box.innerHTML = list(); wireList(); };
    } });
}
// "Show in the first visit" (066, R-023). Off leaves the issue out of a newcomer's first visit only: it is still on Find
// and its own page, and everyone following it still gets its bills. The page is redrawn with the switch still in focus.
async function setFirstVisit(i, on) {
  const redraw = () => { const y = scrollY; hooks.render(); document.getElementById('is-fv')?.focus({ preventScroll: true }); if (Math.abs(scrollY - y) > 1) scrollTo(0, y); };
  try {
    await DB.updateIssue(i.id, { first_visit: on }); redraw();
    toast(on ? `${i.name} is back in the first visit.` : `Left out of the first visit.${i.recommended ? ' Its pre-tick does nothing while it is left out.' : ''}`,
      { ok: on, undo: async () => { await DB.updateIssue(i.id, { first_visit: !on }); redraw(); } });
  } catch (e) { redraw(); toast(e, { err: true }); }
}
async function archive(i, on) {
  if (on) {
    const f = followers(i);
    const ok = await confirmSheet({ title: `Archive ${esc(i.name)}?`, ok: 'Archive', danger: true,
      text: `The public stops seeing it${f && f.own ? `, and the ${plural(f.own, 'person', 'people')} following it stop getting its bills` : ''}. You can restore it from Issues, under Archived. If it is really the same as another issue, merge it instead: its followers move over.` });
    if (!ok) return;
  }
  try {
    await DB.updateIssue(i.id, { archived_at: on ? new Date().toISOString() : null }); hooks.render();
    toast(on ? `Archived ${i.name}.` : `Restored ${i.name}.`, { undo: async () => { await DB.updateIssue(i.id, { archived_at: on ? null : new Date().toISOString() }); hooks.render(); } });
  } catch (e) { toast(e, { err: true }); }
}
export const issuePage = {
  tab: 'myissues',   // v3: issues are under My issues
  title: route => issueById(route.id)?.name || 'Issue',
  // "Back to SB2175" fits on a phone too (R-226, the fresh-eyes review 10/10), so it keeps its words there: full.
  // From My issues (R-263), Back returns there.
  back: route => { const from = billFrom(route); return from ? { href: billRoute(from), label: `Back to ${from.bill_number}`, full: true } : backTo(route); },
  render: pageRender,
  wire(route, root) {
    const i = issueById(route.id); if (!i) return;
    wireConvSection(root, convOpts(i));
    wirePrepCard(i, root);
    const st = P();
    root.querySelector('[data-is="more"]')?.addEventListener('click', () => menuSheet({ title: esc(i.name), items: [
      { label: 'Edit the issue', icon: 'pencil', sub: 'Name, description, stance, between sessions, category, pre-tick', run: async () => { await afterClose(); openIssueForm(i); } },
      { label: 'Merge into another issue', icon: 'arrow-right', disabled: !!i.archived_at, reason: 'Restore it first.', sub: 'When two issues are really one', run: async () => { await afterClose(); mergeSheet(i); } },
      { label: 'Open the public page', icon: 'external-link', disabled: !!i.archived_at || isDraft(i), reason: isDraft(i) ? 'A draft has no public page until it is published.' : 'An archived issue has no public page.', run: () => { window.open(`${PUBLIC_APP()}#/issue/${i.slug}`, '_blank', 'noopener'); } },
      i.archived_at ? { label: 'Restore', icon: 'rotate-ccw', run: () => archive(i, false) } : { label: 'Archive', icon: 'archive', danger: true, run: async () => { await afterClose(); archive(i, true); } },
    ] }));
    root.querySelector('[data-is="restore"]')?.addEventListener('click', () => archive(i, false));
    wireWeek(root);
    // Edit bills and Related's Edit: each opens its own tools in place, and focus goes where the next step is.
    const toggle = (k, focus) => { st[k][i.id] = !st[k][i.id]; const y = scrollY; hooks.render(); if (Math.abs(scrollY - y) > 1) scrollTo(0, y); document.querySelector(focus(st[k][i.id]))?.focus({ preventScroll: true }); };
    root.querySelector('[data-is="editbills"]')?.addEventListener('click', () => toggle('edit', on => on ? '#is-bq' : '[data-is="editbills"]'));
    root.querySelector('[data-is="reledit"]')?.addEventListener('click', () => toggle('rel', on => on ? '[data-is="link"]' : '[data-is="reledit"]'));
    root.querySelector('[data-is="link"]')?.addEventListener('click', () => linkSheet(i));
    root.querySelectorAll('[data-isunlink]').forEach(el => el.onclick = () => { const o = issueById(el.dataset.isunlink); if (o) setLink(i, o, false); });
    root.querySelectorAll('[data-isrelink]').forEach(el => el.onclick = () => { const o = issueById(el.dataset.isrelink); if (o) setLink(i, o, true); });
    root.querySelectorAll('[data-is="stance"]').forEach(el => el.addEventListener('click', () => pickStance(i, { after: () => { hooks.render(); document.querySelector('[data-is="stance"]')?.focus(); } })));
    const fv = root.querySelector('#is-fv'); if (fv) fv.onchange = () => setFirstVisit(i, fv.checked);
    root.querySelectorAll('[data-isrm]').forEach(el => el.onclick = () => { const b = billById(el.dataset.isrm); if (b) takeOff(i, b); });
    // The add search: a combobox like a list's (arrow keys move the highlight, Enter adds, Esc clears).
    const q = root.querySelector('#is-bq'), clear = root.querySelector('[data-is="bqclear"]'), box = root.querySelector('#is-hits'), said = root.querySelector('#is-hitn');
    if (!q) return;
    let hi = -1;
    const opts = () => [...box.querySelectorAll('[data-add]')];
    const mark = k => { opts().forEach((o, n) => { o.classList.toggle('hi', n === k); o.setAttribute('aria-selected', String(n === k)); }); hi = k; if (k >= 0) q.setAttribute('aria-activedescendant', `is-hit-${k}`); else q.removeAttribute('aria-activedescendant'); };
    const paint = () => { box.innerHTML = hitsHTML(i, q.value); const n = opts().length; q.setAttribute('aria-expanded', String(n > 0)); hi = -1; q.removeAttribute('aria-activedescendant');
      said.textContent = q.value.trim().length < 2 ? '' : n ? plural(n, 'bill') + ' found' : 'No bill found'; box.querySelectorAll('[data-add]').forEach(el => el.onclick = () => { const b = billById(el.dataset.add); if (b) putOn(i, b); }); };
    q.oninput = () => { st.q[i.id] = q.value; clear.hidden = !q.value; paint(); };
    q.onkeydown = e => {
      const n = opts().length;
      if (e.key === 'ArrowDown' && n) { e.preventDefault(); mark((hi + 1) % n); }
      else if (e.key === 'ArrowUp' && n) { e.preventDefault(); mark(hi <= 0 ? n - 1 : hi - 1); }
      else if (e.key === 'Enter') { e.preventDefault(); const el = opts()[hi >= 0 ? hi : 0]; if (el) el.click(); }
      else if (e.key === 'Escape' && q.value) { e.preventDefault(); q.value = ''; st.q[i.id] = ''; clear.hidden = true; paint(); }
    };
    clear.onclick = () => { q.value = ''; st.q[i.id] = ''; clear.hidden = true; paint(); q.focus(); };
    paint();
  },
};
