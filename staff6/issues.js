// All issues (#/my-issues/all, the third tab of My issues; #/outreach/issues redirects) and one issue (#/issue/<id>), 063,
// R-018. What the public follows. People follow ISSUES - a policy a resident recognises, like "Free school meals for every
// student" or "Disposable e-cigarette ban" - grouped in six categories, and every bill HIPHI takes a position on that
// carries a followed issue reaches them. Nate, 9/21: Claude tidies the first list from the nicknames "and staff can
// adjust", so this is where the list is kept: rename, describe, move, recommend, merge two that are really one, archive,
// and put bills on issues (also from a bill's Public tab, and from "N position bills with no issue" here).
// #/issue/:id is one issue: a person comes here to see where it stands and what each of its bills needs (R-226, B-1). Its
// "Show in the first visit" switch (066, R-023) leaves an issue out of a newcomer's first visit only. Its "Related issues"
// (095, R-094) are the issues whose bills a follower of this one is shown first. #/my-issues/all?view=first-visit is the
// first visit's numbers and ?view=links makes a link (firstvisit.js, Outreach's; More tools links them).
// Getting the issues ready for 2027 (091, R-088) is prep.js: ?view=prep is the admins' Prep board (F165), shown as a view
// of this page, and ?view=mine the prep list in session; the prep card is on an issue's page.
// v6 (R-336 spec 6, V04, V07, V18): All issues keeps R-272's list (by deadline, a switch to topic, search an extra) in the
// shared rows, with one line for the position bills no issue carries and, for admins, a visible All issues · Prep board
// switch where v5 had a "…" menu (F153, F165). An issue's page is led by where it stands (issuestand.js marks, in words
// with an icon), then its week (coalition.js: hearings and the bills that need a hearing, status only, V07), its bills as
// rows, and the 2027 prep card (inline steps, prep.js). Its public side is guarded: only the owner or an admin flips
// "Show in the first visit" (X27, V18).
import { S, DB, SESSION_YEAR, SESSION_OVER, hooks, esc, advocate, fmtDate, effStage, STAGE_LABEL } from './data.js';
import { billById, plain, PUBLIC_APP, billRef, billByRef, billRoute, stopOf, riskOf, diedish, hearingAhead, whenAt, wantsHearing } from './model.js';
import { ownerFirst } from './model.js';   // R-316 W28
import { icon, btn, iconBtn, empty, toast, openSheet, closeSheet, menuSheet, confirmSheet, switchRow, pickerSheet, pickerChip, ownerOf } from './ui.js';
import { plural, afterClose, billName } from './lists.js';
import { convSectionHTML, wireConvSection, logConversation, refreshConversations } from './conversation.js';
import { FV_HREF, fvView, fvTitle, fvBack, renderFirstVisit, wireFirstVisit } from './firstvisit.js';
import { prepView, prepTitle, renderPrep, wirePrep, prepCardHTML, wirePrepCard, isDraft, stateOf, prepListHref, boardSwitch, BOARD_HREF, prepHoldsOutlook, boardWaits } from './prep.js';
import { testimonyOf, dueOf } from './hearing.js';
import { isPos, dueWhen, waitingOfBills } from './standing.js';
import { weekOfBills, standWeekHTML, wireWeek, billLineRow, billWords } from './coalition.js';
import { standOf, markOf, bodyHTML, toolsHTML, wireTools, listBox, headHTML, rememberRow, restoreRow } from './issuestand.js';
import { PROFILES, caresSecHTML, caresLegs } from './profile.js';   // R-335 (practice copy): "Legislators who care about this"
import { itemRow, nw, dayWords } from './steps.js';
import { gridBody, toolsHTML as gridTools, wireJump, fitLines, pickSort, restoreCard } from './issuegrid.js';   // R-336 walk 3: All issues as cards

// Where an issue's Back goes (R-316 W16): to the prep list or the Prep board it was opened from, to My issues, else All issues.
const backTo = route => route.q?.from === 'prep' ? { href: prepListHref(), label: 'Your issues for 2027' } : route.q?.from === 'board' ? { href: BOARD_HREF, label: 'Prep board' }
  : route.q?.from === 'mine' ? { href: '#/my-issues', label: 'My issues' } : { href: '#/my-issues/all', label: 'All issues' };

// ---- the catalogue ----
export const catByKey = k => (S.categories || []).find(c => c.key === k) || null;
export const issueById = id => (S.issues || []).find(i => String(i.id) === String(id)) || null;
const live = () => (S.issues || []).filter(i => !i.archived_at);
const byName = (a, b) => a.name.localeCompare(b.name);
const byNum = (a, b) => a.bill_number.localeCompare(b.bill_number, 'en', { numeric: true });
export const alsoIn = i => (S.issueCats || []).filter(x => x.issue_id === i.id && x.category !== i.category).map(x => x.category);
export const issuesOfBill = billId => { const on = new Set((S.billIssues || []).filter(x => x.bill_id === billId).map(x => x.issue_id)); return live().filter(i => on.has(i.id)).sort(byName); };
// A link from a bill to one of its issues names the bill (R-226): the issue's Back link then returns to that bill, and
// billFrom reads the name back from the address. Without it (the catalogue, a shared link) Back goes to All issues.
export const issueLinkHref = (i, b) => `#/issue/${encodeURIComponent(i.id)}?from=${encodeURIComponent(billRef(b))}`;
export const billFrom = route => { const ref = route?.q?.from; return ref && !['prep', 'board', 'mine'].includes(ref) ? billByRef(ref) || null : null; };
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
// Who may change what the public sees of an issue (V18, X27: a helper could flip the first-visit switch): its owner, an admin.
const mayPublic = i => !!S.me && (!!S.me.is_admin || i.owner_id === S.me.id);
// Related issues (095, R-094): two issues whose bills are about the same thing. Found by the related-issues tool from the
// words their bills use (backend tools/issue_similarity.js, checked by Nate 9/30); a staff link or unlink here always wins.
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
// HIPHI's stance on the issue as a whole (094, R-093). Mixed: HIPHI backs some bills on it and opposes others. An icon and a
// word, never colour alone (A-5); its own icons, never the thumbs a bill's position uses (the ui-critic review, 9/29).
export const STANCES = [['support', 'Support', 'circle-check', 'HIPHI is for it'], ['oppose', 'Oppose', 'circle-x', 'HIPHI is against it'],
  ['mixed', 'Mixed', 'scale', 'HIPHI supports some bills on it and opposes others']];
const stanceOf = i => STANCES.find(x => x[0] === i?.stance) || null;
// A quiet note when a bill on the issue has gone against the issue's stance (R-095, Nate 10/5): each bill keeps its own
// position, so "HIPHI supports" can sit over a bill HIPHI opposes. Nothing changes by itself; staff decide whether the issue
// should become Mixed.
const FOR = new Set(['strongly_support', 'support', 'support_amend']), AGAINST = new Set(['strongly_oppose', 'oppose']);
export const againstStance = (i, bills) => i?.stance === 'support' ? bills.filter(b => AGAINST.has(b.position)) : i?.stance === 'oppose' ? bills.filter(b => FOR.has(b.position)) : [];
function stanceNote(i, now) {
  const odd = againstStance(i, now); if (!odd.length || i.archived_at) return '';
  const word = i.stance === 'support' ? 'supports' : 'opposes', say = b => FOR.has(b.position) ? 'supports' : 'opposes';
  const list = odd.slice(0, 3).map(b => `<a href="${billRoute(b)}">${esc(billWords(b))}</a> (HIPHI ${say(b)} it)`).join(', ') + (odd.length > 3 ? ` and ${odd.length - 3} more` : '');
  return `<p class="i6-line is6-stnote" role="note">${icon('info')}<span>${odd.length === 1 ? 'One bill on this issue goes' : `${odd.length} bills on this issue go`} against its stance, which says HIPHI ${word} it: ${list}. Each bill keeps its own position. If this is no longer the whole story, set the stance to Mixed.</span></p>`;
}
// Who changes the stance: the issue's owner and admins. Anyone else reads it in plain words (Julie, a new helper, met an
// outlined "Support ▾" she could change; spec 4: no outlined pills, status never looks like a button).
const mayStance = i => !!S.me && (S.me.is_admin || i.owner_id === S.me.id);
const stanceWords = i => { const s = stanceOf(i); return `<span class="is6-stw">${icon(s ? s[2] : 'circle-dashed')}<span>${esc(s ? s[1] : 'No stance yet')}</span></span>`; };
// The picker chip that shows the stance and changes it; `a` carries its data attribute.
export const stanceChip = (i, a = {}) => { const s = stanceOf(i);
  return pickerChip(s ? s[1] : 'No stance', { 'aria-haspopup': 'dialog', 'aria-label': `HIPHI’s stance on ${i.name}: ${s ? s[1] : 'not set'}. Change`, ...a }, s ? s[2] : 'circle-dashed'); };
// Each pick saves at once and says so, with Undo (A-16, B-5). From a bill page (`bill`), the sheet says it is the whole
// issue's stance and not that bill's position.
export function pickStance(i, { after = () => hooks.render(), bill = null } = {}) {
  const n = billsOn(i).filter(thisSession).length;
  const help = bill ? `For the whole issue${n > 1 ? `, all ${n} of its bills` : ''}, not only ${esc(billWords(bill))}. It does not change ${esc(billWords(bill))}’s own position. The public page says it on the issue.`
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

// ---- the issue form: New issue, and Edit the issue (F156) ----
// With `bill`, a new issue is made for that bill and the bill goes on it.
export function openIssueForm(i = null, { bill = null } = {}) {
  const cats = S.categories || [], also = new Set(i ? alsoIn(i) : []), cur = i?.category || cats[0]?.key;
  const body = `<div class="le-sheet is-form">
    ${bill ? `<p class="small muted is-for">For ${esc(billWords(bill))}. It goes on the new issue.</p>` : ''}
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
      <span class="help" id="is-out-h">What happened last session and what to expect. The public page shows it from May to January, under the issue on Home and on its page.</span></div>` : ''}
    <fieldset class="is-cats"><legend>Category</legend>${cats.map(c => `<label class="check is-cat"><input type="radio" name="is-cat" value="${esc(c.key)}" ${c.key === cur ? 'checked' : ''}><span class="is-catic">${icon(c.icon || 'tag')}</span><span>${esc(c.name)}</span></label>`).join('')}</fieldset>
    <fieldset class="is-cats"><legend>Also in <span class="is-opt">(optional)</span></legend><p class="help is-alsoh">When it belongs to two, like the DUI limit: alcohol, and getting around safely.</p>
      ${cats.map(c => `<label class="check is-cat" data-also="${esc(c.key)}"${c.key === cur ? ' hidden' : ''}><input type="checkbox" name="is-also" value="${esc(c.key)}" ${also.has(c.key) ? 'checked' : ''}><span class="is-catic">${icon(c.icon || 'tag')}</span><span>${esc(c.name)}</span></label>`).join('')}</fieldset>
    ${!i || mayPublic(i) ? switchRow('is-rec', 'Pre-tick for new visitors', !!i?.recommended, 'Silent: first-time visitors who pick its category find it already ticked. Nothing on the public page says it was recommended.') : ''}
  </div>`;
  openSheet({ title: i ? 'Edit the issue' : 'New issue', size: 'auto', body,
    foot: btn(i ? 'Save changes' : 'Save as draft', { icon: i ? 'check' : 'plus', attrs: { 'data-issave': '1' } }),
    wire: d => {
      const name = d.querySelector('#is-name'), go = d.querySelector('[data-issave]'), err = d.querySelector('#is-name-err');
      if (!i) name.focus();
      // An issue's own category is not also one of its extra ones.
      d.querySelectorAll('input[name="is-cat"]').forEach(r => r.onchange = () => d.querySelectorAll('[data-also]').forEach(l => { const own = l.dataset.also === r.value; l.hidden = own; if (own) l.querySelector('input').checked = false; }));
      name.oninput = () => { name.removeAttribute('aria-invalid'); err.innerHTML = ''; };
      const save = async () => {
        const nm = name.value.trim().replace(/\s+/g, ' '), description = d.querySelector('#is-desc').value.trim(), category = d.querySelector('input[name="is-cat"]:checked')?.value || cur;
        const extra = [...d.querySelectorAll('input[name="is-also"]:checked')].map(x => x.value).filter(k => k !== category), rec = d.querySelector('#is-rec'), recommended = rec ? rec.checked : !!i?.recommended;
        // Nothing is chosen for a new issue (B-12: never pre-select a stance); left unpicked it stays unset.
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
            toast(bill ? `Saved ${ni.name}, not public yet, with ${billWords(bill)} on it. The public sees it once it is published.` : 'Saved, not public yet. Put its bills on it below.', { ok: true });
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
    const item = i => `<button type="button" role="checkbox" aria-checked="${on.has(i.id)}" data-pick="${esc(i.id)}">${icon(on.has(i.id) ? 'square-check-big' : 'square', { cls: on.has(i.id) ? 'on' : '' })}<span class="body"><span class="title">${esc(i.name)}</span>${isDraft(i) ? '<span class="sub">Not public yet</span>' : i.description ? `<span class="sub">${esc(i.description)}</span>` : ''}</span></button>`;
    const mine = live().filter(i => on.has(i.id) && hit(i)).sort(byName);
    const groups = (S.categories || []).map(c => [c, live().filter(i => i.category === c.key && !on.has(i.id) && hit(i)).sort(byName)]).filter(([, l]) => l.length);
    if (!mine.length && !groups.length) return `<p class="le-none">No issue matches “${esc(q.trim())}”. Make a new one below.</p>`;
    return `${mine.length ? `<h3 class="is-gh">On this bill</h3><div class="sv-pickl">${mine.map(item).join('')}</div>` : ''}
      ${groups.map(([c, l]) => `<h3 class="is-gh">${icon(c.icon || 'tag')}${esc(c.name)}</h3><div class="sv-pickl">${l.map(item).join('')}</div>`).join('')}`;
  };
  const reach = whyNot(b);
  openSheet({ title: `Issues for ${esc(billWords(b))}`,
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

// ---- the index: All issues (F153) ----
const V = () => S.isIdx ??= { q: '', open: null };
// The position bills no issue carries, said in one line (v5: a card of five rows); Choose opens them in a sheet, each with
// its own Choose, which opens the issue picker.
function needsLine() {
  const need = needsIssue(); if (!need.length) return '';
  return `<p class="i6-line">${icon('tag')}<span>${esc(`${plural(need.length, 'position bill')} this session ${need.length === 1 ? 'has' : 'have'} no issue, so nobody following issues gets ${need.length === 1 ? 'it' : 'them'}`)}</span>${btn('Choose', { kind: 'text', sm: true, attrs: { 'data-is': 'needs', 'aria-haspopup': 'dialog' } })}</p>`;
}
function needsSheet() {
  const need = needsIssue();
  openSheet({ title: 'Position bills with no issue', size: 'auto',
    body: `<div class="i6-sheet"><p class="i6-quiet">Put each on an issue, so the people who follow it hear about the bill.</p>${listBox(need.map(b => billLineRow(b, { line: whyNot(b) || 'No issue yet', button: btn('Choose', { kind: 'secondary', sm: true, attrs: { 'data-ispick': b.id, 'aria-haspopup': 'dialog', 'aria-label': `Choose issues for ${billWords(b)}` } }) })).join(''))}</div>`,
    wire: d => d.querySelectorAll('[data-ispick]').forEach(el => el.onclick = async () => { const b = billById(el.dataset.ispick); if (!b) return; await closeSheet({ silent: true }); await afterClose(); openIssuePicker(b); }) });
}
// R-336 walk 3 (Nate: "This needs to be the most organized ... organized like the legislator list"): a grid of cards
// (issuegrid.js) grouped by topic by default, with jump chips and three sorts (By topic, A to Z, By next deadline: R-272's
// order). The find box matches any word a person would use and bill numbers (issuestand.js searcher). Archived issues wait
// in their fold, as rows: they are reference, not the list.
function indexBody(v) {
  const t = plain(v.q.trim()), gone = (S.issues || []).filter(i => i.archived_at && (!t || plain(`${i.name} ${i.description || ''}`).includes(t))).sort(byName);
  const arch = gone.length ? `<details class="i6-fold" data-fold="arch"><summary>${icon('chevron-down', { cls: 'i6-chev' })}<span>Archived (${gone.length})</span></summary>${listBox(gone.map(i => itemRow({ key: i.id, name: i.name, line: 'Archived: the public does not see it', href: '#/issue/' + encodeURIComponent(i.id), cls: 'i6-row' })).join(''))}</details>` : '';
  const tagsOf = x => [isDraft(x.i) ? 'Not public yet' : '', !inFirstVisit(x.i) ? 'Not in the first visit' : ''].filter(Boolean);
  return `${gridBody(live(), { q: v.q, tagsOf })}${arch}`;
}
const index = {
  tab: 'myissues',   // All issues is the third tab of My issues
  title: route => prepTitle(route) || fvTitle(route) || 'All issues',
  back: route => prepView(route) ? { href: '#/my-issues/all', label: 'All issues' } : fvBack(route),
  narrow: route => fvView(route) === 'links',
  render(route) {
    if (prepView(route)) return renderPrep(route);
    if (fvView(route)) return renderFirstVisit(route);
    wantPeople();
    const v = V();
    // New issue on the title's row (a phone: an icon button at the end of the filter line, where the title is the top bar's).
    const acts = btn('New issue', { kind: 'secondary', icon: 'plus', attrs: { 'data-is': 'new', 'aria-haspopup': 'dialog' } });
    const phoneNew = btn('New', { kind: 'secondary', sm: true, icon: 'plus', cls: 'i6-newic', attrs: { 'data-is': 'new', 'aria-haspopup': 'dialog', 'aria-label': 'New issue' } });   // labelled, not a bare + (the critic)
    if (!(S.categories || []).length) return `<div class="le-page i6-page">${headHTML('all')}<div class="le-empty">${empty({ title: 'Issues are not set up yet', text: 'They arrive with migration 063. Ask Claude to load the list.' })}</div></div>`;
    // The admins' All issues · Prep board switch (F165) shows between sessions, when the prep is the work, or while an issue
    // waits for an admin; in session a November job never sits over the list (the critic). Today's line and Team link the
    // board whenever something waits.
    const sw = SESSION_OVER || boardWaits() ? boardSwitch('') : '';
    return `<div class="le-page i6-page is6-index">
      ${headHTML('all', { action: acts })}
      ${sw}
      ${needsLine()}
      ${gridTools(v.q, { extra: phoneNew })}
      <div id="is-q-body">${indexBody(v)}</div>
    </div>`;
  },
  wire(route, root) {
    if (prepView(route)) return wirePrep(route, root);
    if (fvView(route)) return wireFirstVisit(route, root);
    const v = V();
    root.querySelectorAll('[data-is="new"]').forEach(el => el.onclick = () => openIssueForm());
    root.querySelector('[data-is="needs"]')?.addEventListener('click', needsSheet);
    const body = root.querySelector('#is-q-body'), sortB = root.querySelector('[data-igsort]');
    // Redraw the cards only, so typing keeps the focus in the box; Sort hides while a search shows its matches.
    const paint = () => { body.innerHTML = indexBody(v); wireJump(body); fitLines(body); if (sortB) sortB.hidden = !!v.q.trim(); };
    wireJump(body); fitLines(body);
    wireTools(root, 'is-q', { get: () => v.q, set: x => { v.q = x; }, paint });
    if (sortB) sortB.onclick = () => pickSort(root, paint);
    restoreCard(root);
  },
};
export default index;

// ---- one issue (F154) ----
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
const dayAt = d => dayWords(d);
// v5's lines for a bill on an issue, kept for any caller (the issue page now uses the shared rows, coalition.js billLineRow).
export function standLine(b, { owner = 'all' } = {}) {
  if (diedish(b)) return 'Did not advance';
  const st = stopOf(b), h = hearingAhead(b), parts = [STAGE_LABEL[effStage(b)] || ''];
  if (h) {
    parts.push(`Hearing ${whenAt(h.scheduled_at)}${h.committee ? ` · ${h.committee}` : ''}`);
    if (isPos(b)) { const t = testimonyOf(h, b); parts.push(t.filed ? 'Testimony filed' : t.word === 'not started' ? `Testimony due ${dueWhen(dueOf(h))}` : 'Testimony drafted'); }
  } else if (st.deadline?.missed) parts.push(`Missed the ${st.deadline.label} deadline`);
  else if (st.phase === 'committee' && st.deadline) parts.push(`${riskOf(b) ? 'At risk: needs' : 'Needs'} a hearing${st.committee ? ` in ${st.committee}` : ''} by ${dayAt(st.deadline.date)}, ${leftWord(st.deadline)}`);
  else if (st.deadline) parts.push(`${st.deadline.label} ${dayAt(st.deadline.date)}, ${leftWord(st.deadline)}`);
  else if (st.committee) parts.push(`In ${st.committee}`);
  const who = ownerOf(b);
  if (owner === 'others') { if (who && who.id !== S.me?.id) parts.push(`Owner: ${ownerFirst(who)}`); }
  else parts.push(who ? `Owner: ${who.id === S.me?.id ? 'You' : ownerFirst(who)}` : 'No owner');
  return parts.filter(Boolean).join(' · ');
}
export const testimonyWords = (h, b) => { const t = testimonyOf(h, b); return t.filed ? 'testimony filed' : t.word === 'not started' ? `testimony due ${dueWhen(dueOf(h))}` : `testimony ${t.word}`; };
export function nextPhrase(b) {
  let say;
  if (diedish(b)) say = 'Did not advance';
  else { const st = stopOf(b), h = hearingAhead(b);
    say = h ? `Hearing ${whenAt(h.scheduled_at)}` : st.deadline?.missed ? `Missed the ${st.deadline.label} deadline` : st.phase === 'committee' && st.deadline ? `Needs a hearing by ${dayAt(st.deadline.date)}` : st.deadline ? `${st.deadline.label} ${dayAt(st.deadline.date)}` : STAGE_LABEL[effStage(b)] || ''; }
  const who = ownerOf(b);
  return who && who.id !== S.me?.id ? `${say} · Owner: ${ownerFirst(who)}` : say;
}
// A bill's row on the issue's page: its name, its number small, and one line, its step in the shared words (V19); a bill
// whose followers do not get it says why. While editing, the × takes it off (its row's one button).
function billRowOf(i, b, edit) {
  const why = whyNot(b);
  const line = !thisSession(b) ? `${b.session_year} session${diedish(b) ? ', did not advance' : ''}` : diedish(b) ? 'Did not advance' : null;
  return billLineRow(b, { line: line ?? (why && !hearingAhead(b) ? why : undefined), button: edit ? iconBtn('x', `Take ${billWords(b)} off ${i.name}`, { 'data-isrm': b.id }) : '' });
}
// A bill the week above already lists (its hearing this week, or needing a hearing) is not listed again under Bills (A-14);
// "Edit bills" shows them all.
function shownAbove(list) {
  if (SESSION_OVER) return new Set();
  const w = waitingOfBills(list);
  return new Set([...weekOfBills(list).flatMap(x => x.rows.map(h => h.bill_id)), ...[...w.risk, ...w.race].filter(x => wantsHearing(x.b)).map(x => x.b.id)]);
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
  const fold = (id, label, list) => list.length ? `<details class="i6-fold" data-fold="${id}"${edit ? ' open' : ''}><summary>${icon('chevron-down', { cls: 'i6-chev' })}<span>${label}</span></summary>${listBox(list.map(b => billRowOf(i, b, edit)).join(''))}</details>` : '';
  const editBtn = now.length + earlier.length ? btn(edit ? 'Done' : 'Edit bills', { kind: 'text', sm: true, icon: edit ? 'check' : 'pencil', attrs: { 'data-is': 'editbills', 'aria-expanded': String(edit) } }) : '';
  // Every bill already has its row above (its hearing this week, or needing one): no heading over nothing, only Edit bills
  // (the critic: "Its other bills · All 2 of its bills are listed above" was a heading for nothing; A-14).
  if (!edit && now.length && !moving.length && !gone.length && !earlier.length) return `<p class="i6-acts is6-editb">${editBtn}</p>`;
  return `<section class="i6-sec is6-bills" aria-labelledby="is-bh">
      <div class="i6-hrow"><h2 class="i6-h" id="is-bh">${above.size ? 'Its other bills' : 'Its bills'}</h2>${editBtn}</div>
      ${moving.length ? listBox(moving.map(b => billRowOf(i, b, edit)).join('')) : now.length ? '' : `<p class="i6-quiet">No ${esc(SESSION_YEAR)} bills on it yet.</p>`}
      ${fold('gone', `Did not advance (${gone.length})`, gone)}
      ${fold('earlier', `Earlier sessions (${earlier.length})`, earlier)}
      ${edit ? add : ''}
    </section>`;
}
// Followers and the first-visit switch: what the public side of the issue is. Only its owner or an admin changes it
// (V18, X27); everyone else reads it.
function publicCard(i) {
  if (isDraft(i)) return '';
  const f = followers(i);
  const fol = !f ? 'Counting followers…' : `${f.own ? plural(f.own, 'person follows', 'people follow') + ' it' : 'Nobody follows it on its own yet'}${f.via ? `; ${plural(f.via, 'more person gets', 'more people get')} it with a whole category` : ''}`;
  const fv = i.archived_at ? '' : mayPublic(i) ? switchRow('is-fv', 'Show in the first visit', inFirstVisit(i), inFirstVisit(i) ? 'Newcomers can follow it on their first visit.' : 'Left out of a newcomer’s first visit. People can still find and follow it.')
    : `<p class="is6-pl">${icon(inFirstVisit(i) ? 'eye' : 'eye-off')}<span>${inFirstVisit(i) ? 'In the first visit' : 'Left out of the first visit'}</span></p>`;
  return `<section class="is6-card" aria-labelledby="is-ph"><h2 id="is-ph">On the public page</h2>
    <p class="is6-pl">${icon('users')}<span>${esc(fol)}</span></p>${fv}</section>`;
}
// The lead: where the issue stands, said first, in words with an icon (issuestand.js, R-272's marks).
function leadHTML(i) {
  if (i.archived_at) return '';
  if (SESSION_OVER) return '';
  const x = standOf(i), m = markOf(x);
  // "SB 2175 needs a hearing by Mon 3/30" over the heading "Needs a hearing by Mon 3/30" and that same bill says it twice
  // (the critic, A-14): the section says it.
  if (x.state === 'ahead' && x.facing?.length) return '';
  return m ? `<p class="i6-lead">${m.ic ? icon(m.ic) : ''}<span>${nw(esc(m.text))}</span></p>` : '';
}
function pageRender(route) {
  const i = issueById(route.id);
  if (!i) return `<div class="le-page i6-page">${empty({ h: 'h1', title: 'This issue is not here', text: 'It may have been merged into another, or the link is old.', action: btn('See all issues', { kind: 'secondary', href: '#/my-issues/all' }) })}</div>`;
  wantPeople();
  const c = catByKey(i.category), also = alsoIn(i).map(catByKey).filter(Boolean), bills = billsOn(i).sort(byNum), now = bills.filter(thisSession), earlier = bills.filter(b => !thisSession(b));
  const from = billFrom(route), bk = backTo(route), wide = (() => { try { return matchMedia('(min-width: 1100px)').matches; } catch { return false; } })();
  // The outlook is what the public reads between sessions: under the name then, and in session inside the 2027 card.
  const outlook = i.outlook ? `<p class="is6-desc"><span class="is6-dl">Between sessions, the public reads:</span> ${esc(i.outlook)}</p>` : '';
  const head = `<header class="is6-head">
      <span class="is6-icon" aria-hidden="true">${icon(c?.icon || 'tag')}</span>
      <div class="is6-hbody"><h1 class="is6-h1">${esc(i.name)}</h1>
        ${i.description ? `<p class="is6-desc">${esc(i.description)}</p>` : ''}
        ${SESSION_OVER ? (prepHoldsOutlook(i) ? '' : outlook) : (i.goal || '').trim() ? `<p class="is6-desc"><span class="is6-dl">Our ${esc(SESSION_YEAR)} goal, staff only:</span> ${esc(i.goal)}</p>` : ''}
        <p class="is6-meta"><span class="is6-stl">HIPHI’s stance</span>${mayStance(i) ? stanceChip(i, { 'data-is': 'stance' }) : stanceWords(i)}<span class="is6-cat">${esc([c?.name || i.category, also.length ? `also in ${also.map(x => x.name).join(' and ')}` : '', i.recommended ? 'pre-ticked for new visitors' : ''].filter(Boolean).join(' · '))}</span></p>
        ${stanceNote(i, now)}
      </div>
      <div class="is6-hacts">${btn('Edit', { kind: 'text', sm: true, icon: 'pencil', cls: 'is6-edit', attrs: { 'data-is': 'edit', 'aria-haspopup': 'dialog', 'aria-label': `Edit ${i.name}` } })}${iconBtn('ellipsis', `More for ${i.name}: merge, public page, archive`, { 'data-is': 'more', 'aria-haspopup': 'dialog' })}</div>
    </header>
    ${i.archived_at ? `<p class="i6-line">${icon('archive')}<span><b>Archived.</b> The public does not see it, and its followers do not get its bills.</span>${btn('Restore', { kind: 'secondary', sm: true, attrs: { 'data-is': 'restore' } })}</p>` : ''}`;
  // R-316 W16: between sessions the 2027 prep is the work, so its card comes first; once approved it folds and goes under the bills.
  const prep = prepCardHTML(i, { outlook: SESSION_OVER ? '' : outlook }), prepFirst = SESSION_OVER && !isDraft(i) && !i.archived_at && stateOf(i) !== 'approved';
  const week = i.archived_at || SESSION_OVER ? '' : standWeekHTML(now.filter(b => b.tracked !== false), { key: 'is' + i.id, byBill: true });
  const work = prepFirst || isDraft(i) ? `${prep}${week}${billsHTML(i, now, earlier)}` : `${leadHTML(i)}${week}${billsHTML(i, now, earlier)}${prep}`;
  // Legislators who care (R-335, practice copy): its list when there is one, else one quiet line, no instructions (the critic).
  const cares = !PROFILES() || i.archived_at ? '' : caresLegs(i.id).length ? caresSecHTML(i) : `<p class="i6-line is6-none">${icon('landmark')}<span>Legislators who care about this: none yet</span></p>`;
  const aside = `${publicCard(i)}${i.archived_at ? '' : relatedHTML(i)}${cares}`;
  const back = `<a class="co6-back" href="${from ? billRoute(from) : bk.href}" data-back${from ? ` aria-label="Back to ${esc(from.bill_number)}"` : ''}>${icon('chevron-left')}<span>${from ? `Back to ${esc(from.bill_number)}` : esc(bk.label)}</span></a>`;
  // A laptop: the issue and its week on the left; its public side and related issues in the one side panel (as a
  // coalition's page keeps sharing there). A phone reads it all in one column, the work first.
  const conv = `${convSectionHTML(convOpts(i))}${convLine}`;
  if (wide) return `<div class="le-page is6-page">${back}<div class="is6-cols">
      <div class="is6-main">${head}${work}${conv}</div>
      <aside class="is6-side" aria-label="On the public page, and related issues">${aside}</aside></div></div>`;
  return `<div class="le-page is6-page">${back}${head}${work}${aside}${conv}</div>`;
}
// A link works both ways: unlinking here unlinks it on the other issue's page too. Each row is the other issue's name and
// one line (its category when it is another one, "Linked by staff" for links nobody's wording found).
function relatedHTML(i) {
  const { on, off } = relatedOf(i), edit = !!P().rel[i.id];
  // A row's line only when it says something (the critic: every row said "Same topic"): another topic, or linked by staff.
  const cap1 = t => t ? t[0].toUpperCase() + t.slice(1) : t;
  const about = (o, staff) => cap1([o.category === i.category ? '' : catByKey(o.category)?.name || o.category, staff ? 'linked by staff' : ''].filter(Boolean).join(', '));
  const who = c => { const a = c.set_by && advocate(c.set_by); return `unlinked${a ? ` by ${a.full_name.split(' ')[0]}` : ''}${c.set_at ? ` ${fmtDate(c.set_at)}` : ''}`; };
  const row = (o, line, button = '') => itemRow({ key: o.id, name: o.name, line: line ? esc(line) : '', href: `#/issue/${encodeURIComponent(o.id)}`, button, cls: 'i6-row' });
  return `<section class="i6-sec is6-rel" aria-labelledby="is-rh">
    <div class="i6-hrow"><h2 class="i6-h" id="is-rh">Related issues</h2>${btn(edit ? 'Done' : 'Edit', { kind: 'text', sm: true, attrs: { 'data-is': 'reledit', 'aria-expanded': String(edit), 'aria-label': edit ? 'Done editing related issues' : 'Edit related issues' } })}</div>
    <p class="i6-quiet">Followers of either one see the other’s bills first.</p>
    ${on.length ? listBox(on.map(({ o, staff }) => row(o, about(o, staff), edit ? iconBtn('x', `Unlink ${o.name} from ${i.name}`, { 'data-isunlink': o.id }) : '')).join('')) : '<p class="i6-quiet">None yet.</p>'}
    ${edit ? `<p class="i6-acts">${btn('Link another issue', { kind: 'secondary', sm: true, icon: 'link', attrs: { 'data-is': 'link', 'aria-haspopup': 'dialog' } })}</p>
    ${off.length ? `<details class="i6-fold" data-fold="unlinked"><summary>${icon('chevron-down', { cls: 'i6-chev' })}<span>Unlinked by staff (${off.length})</span></summary>
      ${listBox(off.map(({ o, c }) => row(o, cap1([about(o), who(c)].filter(Boolean).join(', ')), btn('Link again', { kind: 'text', sm: true, attrs: { 'data-isrelink': o.id } }))).join(''))}</details>` : ''}` : ''}
  </section>`;
}
async function setLink(i, o, on) {
  const redraw = () => { const y = scrollY; hooks.render(); if (Math.abs(scrollY - y) > 1) scrollTo(0, y); document.getElementById('is-rh')?.closest('section')?.querySelector('[data-is="link"], [data-is="reledit"]')?.focus({ preventScroll: true }); };
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
// With none yet, the section is one quiet line with Log a talk, the act's one name (the critic: an empty section explained itself in two sentences);
// the section itself shows once there is one (hideEmpty), and the line hides then.
const convOpts = i => ({ id: 'is-cv', q: { issueIds: [i.id] }, here: { issueId: i.id }, kind: 'le', limit: 5, log: { issueId: i.id }, hideEmpty: true, none: 'None yet.' });
const convLine = `<p class="i6-line is6-none" data-is="cvline">${icon('message-square')}<span>No conversations yet</span>${btn('Log a talk', { kind: 'text', sm: true, attrs: { 'data-is': 'cvlog', 'aria-haspopup': 'dialog', 'aria-label': 'Log a conversation about this issue' } })}</p>`;
async function takeOff(i, b) {
  try {
    await DB.setBillIssue(b.id, i.id, false); hooks.render();
    toast(`Took ${billWords(b)} off ${i.name}.`, { undo: async () => { await DB.setBillIssue(b.id, i.id, true); hooks.render(); } });
  } catch (e) { toast(e, { err: true }); }
}
async function putOn(i, b) {
  try {
    await DB.setBillIssue(b.id, i.id, true); P().q[i.id] = ''; hooks.render();
    document.getElementById('is-bq')?.focus();
    const why = whyNot(b);
    toast(`Put ${billWords(b)} on ${i.name}.${why ? ` ${why.split(',')[0]}, so followers get it once that changes.` : ''}`, { ok: !why, undo: async () => { await DB.setBillIssue(b.id, i.id, false); hooks.render(); } });
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
      text: `The public stops seeing it${f && f.own ? `, and the ${plural(f.own, 'person', 'people')} following it stop getting its bills` : ''}. You can restore it from All issues, under Archived. If it is really the same as another issue, merge it instead: its followers move over.` });
    if (!ok) return;
  }
  try {
    await DB.updateIssue(i.id, { archived_at: on ? new Date().toISOString() : null }); hooks.render();
    toast(on ? `Archived ${i.name}.` : `Restored ${i.name}.`, { undo: async () => { await DB.updateIssue(i.id, { archived_at: on ? null : new Date().toISOString() }); hooks.render(); } });
  } catch (e) { toast(e, { err: true }); }
}
export const issuePage = {
  tab: 'myissues',   // issues are under My issues
  // "Back to SB2175" fits on a phone too (R-226), so it keeps its words there: full. From My issues (R-263), Back returns there.
  title: route => issueById(route.id)?.name || 'Issue',
  back: route => { const from = billFrom(route); return from ? { href: billRoute(from), label: `Back to ${from.bill_number}`, full: true } : backTo(route); },
  wide: () => { try { return matchMedia('(min-width: 1100px)').matches; } catch { return false; } },
  render: pageRender,
  wire(route, root) {
    const i = issueById(route.id); if (!i) return;
    rememberRow(i.id);
    wireConvSection(root, convOpts(i));
    // The one-line "No conversations yet" shows while the section is hidden (empty), and hides once it shows.
    const cvSec = root.querySelector('[data-cvsec="is-cv"]'), cvLine = root.querySelector('[data-is="cvline"]');
    if (cvSec && cvLine) { const sync = () => { cvLine.hidden = !cvSec.hidden; }; sync(); new MutationObserver(sync).observe(cvSec, { attributes: true, attributeFilter: ['hidden'] }); }
    root.querySelector('[data-is="cvlog"]')?.addEventListener('click', () => logConversation({ issueId: i.id, onDone: () => { refreshConversations(); hooks.render(); } }));
    wirePrepCard(i, root);
    const st = P();
    // The "…" holds the rare actions (F155); Edit is also a visible text button beside it.
    root.querySelector('[data-is="edit"]')?.addEventListener('click', () => openIssueForm(i));
    root.querySelector('[data-is="more"]')?.addEventListener('click', () => menuSheet({ title: esc(i.name), items: [
      { label: 'Edit the issue', icon: 'pencil', sub: 'Name, description, stance, between sessions, category, pre-tick', run: async () => { await afterClose(); openIssueForm(i); } },
      { label: 'Merge into another issue', icon: 'arrow-right', disabled: !!i.archived_at, reason: 'Restore it first.', sub: 'When two issues are really one', run: async () => { await afterClose(); mergeSheet(i); } },
      { label: 'Open the public page', icon: 'external-link', disabled: !!i.archived_at || isDraft(i), reason: isDraft(i) ? 'An issue that is not public yet has no public page.' : 'An archived issue has no public page.', run: () => { window.open(`${PUBLIC_APP()}#/issue/${i.slug}`, '_blank', 'noopener'); } },
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
// v5's door to the first visit, kept for any caller (More tools links it now).
export const FIRST_VISIT_HREF = FV_HREF;
