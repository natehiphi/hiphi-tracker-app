// Outreach > Issues (063, R-018). What the public follows. People follow ISSUES - a policy a resident recognises, like
// "Free school meals for every student" or "Disposable vape ban" - grouped in six categories, and every bill HIPHI
// takes a position on that carries a followed issue reaches them: this session's, later ones, and next session's once
// they are put on it here. Nate, 9/21: Claude tidies the first list from the nicknames "and staff can adjust", so this
// is where the list is kept: rename, describe, move, recommend, merge two that are really one, archive, and put bills
// on issues (also from a bill's Public tab, and from the queue below).
// The index leads with what would otherwise go unnoticed: position bills this session that no issue carries, which
// nobody following issues would ever hear of. #/issue/:id is one issue: its bills, its followers and its ⋯ menu, laid
// out like a list's page.
import { S, DB, SESSION_YEAR, hooks, esc } from './data.js';
import { billById, billNum, plain, PUBLIC_APP } from './model.js';
import { icon, btn, iconBtn, row, chip, empty, toast, openSheet, closeSheet, menuSheet, confirmSheet, switchRow, notice, posChip } from './ui.js';
import { plural, pageHead, afterClose, billName } from './lists.js';
import { convSectionHTML, wireConvSection } from './conversation.js';

// ---- the catalogue ----
export const catByKey = k => (S.categories || []).find(c => c.key === k) || null;
export const issueById = id => (S.issues || []).find(i => String(i.id) === String(id)) || null;
const live = () => (S.issues || []).filter(i => !i.archived_at);
const byName = (a, b) => a.name.localeCompare(b.name);
const byNum = (a, b) => a.bill_number.localeCompare(b.bill_number, 'en', { numeric: true });
export const alsoIn = i => (S.issueCats || []).filter(x => x.issue_id === i.id && x.category !== i.category).map(x => x.category);
export const issuesOfBill = billId => { const on = new Set((S.billIssues || []).filter(x => x.bill_id === billId).map(x => x.issue_id)); return live().filter(i => on.has(i.id)).sort(byName); };
const billsOn = i => (S.billIssues || []).filter(x => x.issue_id === i.id).map(x => billById(x.bill_id)).filter(Boolean);
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

// ---- the issue form: New issue, and Edit on an issue's page ----
// With `bill`, a new issue is made for that bill and the bill goes on it.
export function openIssueForm(i = null, { bill = null } = {}) {
  const cats = S.categories || [], also = new Set(i ? alsoIn(i) : []), cur = i?.category || cats[0]?.key;
  const body = `<div class="le-sheet is-form">
    ${bill ? `<p class="small muted is-for">For ${esc(billNum(bill))}${bill.nickname ? `, ${esc(bill.nickname)}` : ''}. It goes on the new issue.</p>` : ''}
    <div class="field"><label for="is-name">Name</label><input id="is-name" maxlength="60" autocomplete="off" value="${esc(i?.name || '')}" placeholder="Free school meals for every student" aria-describedby="is-name-h is-name-err">
      <span class="help" id="is-name-h">A policy people recognise, in everyday words. The public follows it by this name.</span><div id="is-name-err" role="alert"></div></div>
    <div class="field"><label for="is-desc">Description</label><textarea id="is-desc" rows="3" maxlength="240" aria-describedby="is-desc-h">${esc(i?.description || '')}</textarea>
      <span class="help" id="is-desc-h">One sentence on what would change. The public sees it.</span></div>
    <fieldset class="is-cats"><legend>Category</legend>${cats.map(c => `<label class="check is-cat"><input type="radio" name="is-cat" value="${esc(c.key)}" ${c.key === cur ? 'checked' : ''}><span class="is-catic">${icon(c.icon || 'tag')}</span><span>${esc(c.name)}</span></label>`).join('')}</fieldset>
    <fieldset class="is-cats"><legend>Also in <span class="is-opt">(optional)</span></legend><p class="help is-alsoh">When it belongs to two, like the DUI limit: alcohol, and getting around safely.</p>
      ${cats.map(c => `<label class="check is-cat" data-also="${esc(c.key)}"${c.key === cur ? ' hidden' : ''}><input type="checkbox" name="is-also" value="${esc(c.key)}" ${also.has(c.key) ? 'checked' : ''}><span class="is-catic">${icon(c.icon || 'tag')}</span><span>${esc(c.name)}</span></label>`).join('')}</fieldset>
    ${switchRow('is-rec', 'Pre-tick for new visitors', !!i?.recommended, 'Silent: first-time visitors who pick its category find it already ticked. Nothing on the public page says it was recommended.')}
  </div>`;
  openSheet({ title: i ? 'Edit issue' : 'New issue', size: 'auto', body,
    foot: btn(i ? 'Save changes' : 'Create issue', { icon: i ? 'check' : 'plus', attrs: { 'data-issave': '1' } }),
    wire: d => {
      const name = d.querySelector('#is-name'), go = d.querySelector('[data-issave]'), err = d.querySelector('#is-name-err');
      if (!i) name.focus();
      // An issue's own category is not also one of its extra ones.
      d.querySelectorAll('input[name="is-cat"]').forEach(r => r.onchange = () => d.querySelectorAll('[data-also]').forEach(l => { const own = l.dataset.also === r.value; l.hidden = own; if (own) l.querySelector('input').checked = false; }));
      name.oninput = () => { name.removeAttribute('aria-invalid'); err.innerHTML = ''; };
      const save = async () => {
        const nm = name.value.trim().replace(/\s+/g, ' '), description = d.querySelector('#is-desc').value.trim(), category = d.querySelector('input[name="is-cat"]:checked')?.value || cur;
        const extra = [...d.querySelectorAll('input[name="is-also"]:checked')].map(x => x.value).filter(k => k !== category), recommended = d.querySelector('#is-rec').checked;
        const clash = live().find(x => x.id !== i?.id && plain(x.name) === plain(nm));
        const bad = nm.length < 2 ? 'Give the issue a name.' : clash ? `There is already an issue called “${clash.name}”. Use that one, or merge them.` : '';
        if (bad) { name.setAttribute('aria-invalid', 'true'); err.innerHTML = `<span class="err">${icon('circle-alert')}${esc(bad)}</span>`; name.focus(); return; }
        go.setAttribute('aria-busy', 'true'); go.disabled = true;
        try {
          if (i) {
            await DB.updateIssue(i.id, { name: nm, description: description || null, category, recommended });
            await DB.setIssueAlso(i.id, extra);
            closeSheet({ silent: true }); hooks.render(); toast('Saved. The public page shows the new wording.', { ok: true });
          } else {
            const ni = await DB.createIssue({ name: nm, description, category, also: extra, recommended });
            if (bill) await DB.setBillIssue(bill.id, ni.id, true);
            closeSheet({ silent: true }); await afterClose();
            if (bill) { hooks.render(); toast(`Made ${ni.name} and put ${billNum(bill)} on it.`, { ok: true }); }
            else { S.go('#/issue/' + encodeURIComponent(ni.id)); toast('Issue made. Put its bills on it below.', { ok: true }); }
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
    const item = i => `<button type="button" role="checkbox" aria-checked="${on.has(i.id)}" data-pick="${esc(i.id)}">${icon(on.has(i.id) ? 'square-check-big' : 'square', { cls: on.has(i.id) ? 'on' : '' })}<span class="body"><span class="title">${esc(i.name)}</span>${i.description ? `<span class="sub">${esc(i.description)}</span>` : ''}</span></button>`;
    const mine = live().filter(i => on.has(i.id) && hit(i)).sort(byName);
    const groups = (S.categories || []).map(c => [c, live().filter(i => i.category === c.key && !on.has(i.id) && hit(i)).sort(byName)]).filter(([, l]) => l.length);
    if (!mine.length && !groups.length) return `<p class="le-none">No issue matches “${esc(q.trim())}”. Make a new one below.</p>`;
    return `${mine.length ? `<h3 class="is-gh">On this bill</h3><div class="sv-pickl">${mine.map(item).join('')}</div>` : ''}
      ${groups.map(([c, l]) => `<h3 class="is-gh">${icon(c.icon || 'tag')}${esc(c.name)}</h3><div class="sv-pickl">${l.map(item).join('')}</div>`).join('')}`;
  };
  const reach = whyNot(b);
  openSheet({ title: `Issues for ${esc(billNum(b))}`,
    body: `<div class="is-picker"><p class="small muted is-for">${b.nickname ? `${esc(b.nickname)}. ` : ''}Everyone who follows a ticked issue gets this bill${reach ? ` once it has a position and is public (${esc(reach.split(',')[0].toLowerCase())} now)` : ''}. Each tap saves.</p>
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

// ---- the index ----
const V = () => S.isIdx ??= { q: '', needsAll: false };
function issueRow(i) {
  const bills = billsOn(i), now = bills.filter(thisSession), f = followers(i);
  const meta = [plural(now.length, 'bill') + (SESSION_YEAR ? ` in ${SESSION_YEAR}` : ''), f && f.own ? plural(f.own, 'follower') : ''].filter(Boolean).join(' · ');
  return row({ title: esc(i.name), sub: `<span class="is-meta">${esc(meta)}</span>${i.description ? `<span class="is-desc">${esc(i.description)}</span>` : ''}`,
    end: i.recommended ? chip('Pre-ticked', 'info', 'star') : '', href: '#/issue/' + encodeURIComponent(i.id), cls: 'is-row' });
}
function needsHTML(v) {
  const need = needsIssue(); if (!need.length) return '';
  const shown = v.needsAll ? need : need.slice(0, 5);
  return `<section class="card is-needs" aria-labelledby="is-nh">
    <h2 id="is-nh">${icon('triangle-alert')}<span>${plural(need.length, 'position bill')} this session with no issue</span></h2>
    <p class="small">Nobody following issues gets ${need.length === 1 ? 'it' : 'these'}. Put each one on an issue.</p>
    <ul class="rows is-nlist">${shown.map(b => `<li class="is-nrow"><a class="is-nmain" href="#/bill/${encodeURIComponent(b.bill_number)}/public">${billName(b, 90)}</a>${btn('Choose', { kind: 'secondary', sm: true, attrs: { 'data-ispick': b.id, 'aria-haspopup': 'dialog', 'aria-label': `Choose issues for ${billNum(b)}` } })}</li>`).join('')}</ul>
    ${need.length > shown.length ? btn(`Show all ${need.length}`, { kind: 'text', icon: 'chevron-down', attrs: { 'data-is': 'needsall' } }) : ''}
  </section>`;
}
function indexBody(v) {
  const t = plain(v.q.trim()), hit = i => !t || plain(`${i.name} ${i.description || ''}`).includes(t);
  const secs = (S.categories || []).map(c => {
    const own = live().filter(i => i.category === c.key), shown = own.filter(hit).sort((a, b) => (a.sort_order ?? 100) - (b.sort_order ?? 100) || byName(a, b));
    if (t && !shown.length) return '';
    return `<section class="is-cat" aria-labelledby="is-c-${esc(c.key)}"><div class="le-sechead is-chead"><h2 id="is-c-${esc(c.key)}"><span class="is-catic">${icon(c.icon || 'tag')}</span>${esc(c.name)}</h2><span class="meta">${plural(own.length, 'issue')}</span></div>
      ${shown.length ? `<div class="rows">${shown.map(issueRow).join('')}</div>` : '<p class="le-none">No issues in it yet.</p>'}</section>`;
  }).join('');
  const gone = (S.issues || []).filter(i => i.archived_at && hit(i)).sort(byName);
  return `${secs || `<p class="le-none">No issue matches “${esc(v.q.trim())}”.</p>`}
    ${gone.length ? `<details class="is-arch"><summary>${icon('archive')}<span>Archived (${gone.length})</span>${icon('chevron-down', { cls: 'is-chev' })}</summary><div class="rows">${gone.map(issueRow).join('')}</div></details>` : ''}`;
}
const index = {
  tab: 'outreach',
  title: () => 'Outreach',
  wide: () => true,
  render() {
    wantPeople();
    const v = V(), n = live().length;
    const newBtn = btn('New issue', { icon: 'plus', attrs: { 'data-is': 'new', 'aria-haspopup': 'dialog' } });
    if (!(S.categories || []).length) return `<div class="le-page is-index">${pageHead('issues', 'Issues', 'What the public follows.', '')}<div class="le-empty">${empty({ title: 'Issues are not set up yet', text: 'They arrive with migration 063. Ask Claude to load the list.' })}</div></div>`;
    return `<div class="le-page is-index">
      ${pageHead('issues', 'Issues', `What the public follows. A bill reaches everyone who follows an issue it is on. <span class="le-sum">${plural(n, 'issue')}</span>`, newBtn)}
      ${needsHTML(v)}
      <div class="le-search is-find">${icon('search')}<input id="is-q" type="search" placeholder="Find an issue" value="${esc(v.q)}" autocomplete="off" aria-label="Find an issue" aria-controls="is-body">${iconBtn('x', 'Clear the search', { 'data-is': 'qclear', hidden: !v.q })}</div>
      <div id="is-body">${indexBody(v)}</div>
    </div>`;
  },
  wire(route, root) {
    const v = V();
    root.querySelectorAll('[data-is="new"]').forEach(el => el.onclick = () => openIssueForm());
    root.querySelector('[data-is="needsall"]')?.addEventListener('click', () => { v.needsAll = true; hooks.render(); });
    root.querySelectorAll('[data-ispick]').forEach(el => el.onclick = () => { const b = billById(el.dataset.ispick); if (b) openIssuePicker(b); });
    const q = root.querySelector('#is-q'), clear = root.querySelector('[data-is="qclear"]'), body = root.querySelector('#is-body');
    if (q) q.oninput = () => { v.q = q.value; clear.hidden = !q.value; body.innerHTML = indexBody(v); };
    if (clear) clear.onclick = () => { v.q = ''; q.value = ''; clear.hidden = true; body.innerHTML = indexBody(v); q.focus(); };
  },
};
export default index;

// ---- one issue ----
const P = () => S.isPage ??= { q: {} };
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
function billLine(i, b) {
  const why = whyNot(b);
  return `<li class="le-brow" data-bid="${esc(b.id)}">
    <a class="le-bmain" href="#/bill/${encodeURIComponent(b.bill_number)}">${billName(b, 140)}
      <span class="is-bmeta">${posChip(b.position || '')}${thisSession(b) ? '' : `<span class="meta">${esc(b.session_year)}</span>`}</span>
      ${why ? `<span class="le-warn">${icon('eye-off')}${esc(why)}</span>` : ''}</a>
    ${iconBtn('x', `Take ${billNum(b)} off ${i.name}`, { 'data-isrm': b.id })}
  </li>`;
}
function pageRender(route) {
  const i = issueById(route.id);
  if (!i) return `<div class="le-page le-list">${empty({ h: 'h1', title: 'This issue is not here', text: 'It may have been merged into another, or the link is old.', action: btn('See all issues', { href: '#/outreach/issues' }) })}</div>`;
  wantPeople();
  const c = catByKey(i.category), also = alsoIn(i).map(catByKey).filter(Boolean), bills = billsOn(i).sort(byNum), now = bills.filter(thisSession), earlier = bills.filter(b => !thisSession(b));
  const f = followers(i), q = P().q[i.id] || '';
  const fol = !f ? '<span class="meta">Counting followers…</span>'
    : `<span class="le-fol">${icon('users')}<span>${f.own ? plural(f.own, 'person follows', 'people follow') + ' it' : 'Nobody follows it on its own yet'}${f.via ? `; ${plural(f.via, 'more person gets', 'more people get')} it with a whole category` : ''}</span></span>`;
  const reachN = now.filter(b => !whyNot(b)).length;
  return `<div class="le-page le-list is-page">
    <a class="le-deskback" href="#/outreach/issues" data-back>${icon('chevron-left')}<span>Issues</span></a>
    <header class="le-lhead">
      <span class="le-licon">${icon(c?.icon || 'tag')}</span>
      <div class="le-lhbody"><h1>${esc(i.name)}</h1>
        ${i.description ? `<p class="le-ldesc">${esc(i.description)}</p>` : ''}
        <p class="meta">${esc(c?.name || i.category)}${also.length ? ` · also in ${esc(also.map(x => x.name).join(' and '))}` : ''}${i.recommended ? ' · Pre-ticked for new visitors' : ''}</p></div>
      ${iconBtn('ellipsis', `More for ${i.name}`, { 'data-is': 'more', 'aria-haspopup': 'dialog' }, 'le-hmore')}
    </header>
    ${i.archived_at ? notice('warn', 'archive', '<b>Archived.</b> The public does not see it, and its followers do not get its bills.', btn('Restore', { kind: 'secondary', sm: true, attrs: { 'data-is': 'restore' } })) : ''}
    <section class="card le-pubcard is-folcard" aria-label="Followers"><div class="le-sharerow">${fol}${i.archived_at ? '' : btn('See it', { kind: 'secondary', sm: true, icon: 'external-link', href: `${PUBLIC_APP()}#/issue/${i.slug}`, target: '_blank' })}</div></section>
    <section class="le-sec" aria-labelledby="is-bh">
      <div class="le-sechead"><h2 id="is-bh">Bills</h2><span class="meta">${now.length ? `${plural(now.length, 'bill')} in ${SESSION_YEAR}${reachN < now.length ? ` · ${reachN} reach followers` : ''}` : ''}</span></div>
      <div class="le-add">
        <label class="sr" for="is-bq">Put a bill on this issue: number or words</label>
        <div class="le-search">${icon('search')}<input id="is-bq" type="search" role="combobox" aria-expanded="false" aria-autocomplete="list" placeholder="Put a bill on it: number or words" value="${esc(q)}" autocomplete="off" enterkeyhint="search" aria-controls="is-hits">${iconBtn('x', 'Clear the search', { 'data-is': 'bqclear', hidden: !q })}</div>
        <div id="is-hits">${hitsHTML(i, q)}</div>
        <p class="sr" id="is-hitn" role="status"></p>
      </div>
      ${now.length ? `<ol class="rows le-bills">${now.map(b => billLine(i, b)).join('')}</ol>`
        : `<div class="le-empty">${empty({ h: 'h3', title: `No ${SESSION_YEAR} bills yet`, text: 'Search above to put bills on it. Its followers get each one that has a position and is public.' })}</div>`}
      ${earlier.length ? `<details class="is-arch"><summary>${icon('history')}<span>Earlier sessions (${earlier.length})</span>${icon('chevron-down', { cls: 'is-chev' })}</summary><ol class="rows le-bills">${earlier.map(b => billLine(i, b)).join('')}</ol></details>` : ''}
    </section>
    ${convSectionHTML(convOpts(i))}
  </div>`;
}
// Conversations with legislators filed under this issue, from any of its bills or a legislator's page (R-022 wave 2 #9,
// conversation.js): an issue carries across sessions where a bill does not.
const convOpts = i => ({ id: 'is-cv', q: { issueIds: [i.id] }, here: { issueId: i.id }, kind: 'le', limit: 5, log: { issueId: i.id },
  none: 'None logged yet. A conversation logged under this issue, from any of its bills or a legislator’s page, shows here.' });
async function takeOff(i, b) {
  try {
    await DB.setBillIssue(b.id, i.id, false); hooks.render();
    toast(`Took ${billNum(b)} off ${i.name}.`, { undo: async () => { await DB.setBillIssue(b.id, i.id, true); hooks.render(); } });
  } catch (e) { toast(e, { err: true }); }
}
async function putOn(i, b) {
  try {
    await DB.setBillIssue(b.id, i.id, true); P().q[i.id] = ''; hooks.render();
    document.getElementById('is-bq')?.focus();
    const why = whyNot(b);
    toast(`Put ${billNum(b)} on ${i.name}.${why ? ` ${why.split(',')[0]}, so followers get it once that changes.` : ''}`, { ok: !why, undo: async () => { await DB.setBillIssue(b.id, i.id, false); hooks.render(); } });
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
  tab: 'outreach',
  title: route => issueById(route.id)?.name || 'Issue',
  back: () => ({ href: '#/outreach/issues', label: 'Issues' }),
  render: pageRender,
  wire(route, root) {
    const i = issueById(route.id); if (!i) return;
    wireConvSection(root, convOpts(i));
    const st = P();
    root.querySelector('[data-is="more"]')?.addEventListener('click', () => menuSheet({ title: esc(i.name), items: [
      { label: 'Edit', icon: 'pencil', sub: 'Name, description, category, pre-tick', run: async () => { await afterClose(); openIssueForm(i); } },
      { label: 'Merge into another issue', icon: 'arrow-right', disabled: !!i.archived_at, reason: 'Restore it first.', sub: 'When two issues are really one', run: async () => { await afterClose(); mergeSheet(i); } },
      { label: 'Open the public page', icon: 'external-link', disabled: !!i.archived_at, reason: 'An archived issue has no public page.', run: () => { window.open(`${PUBLIC_APP()}#/issue/${i.slug}`, '_blank', 'noopener'); } },
      i.archived_at ? { label: 'Restore', icon: 'rotate-ccw', run: () => archive(i, false) } : { label: 'Archive', icon: 'archive', danger: true, run: async () => { await afterClose(); archive(i, true); } },
    ] }));
    root.querySelector('[data-is="restore"]')?.addEventListener('click', () => archive(i, false));
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
