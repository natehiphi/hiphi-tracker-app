// Getting the issues ready for 2027 (backend 091, REQUESTS R-088, backend docs/PREP-2027-PLAN.md). Nate 9/29: staff are
// "easily assigned different issues now" to "prepare materials for the 2027 launch", and "as new issues pop up throughout
// session" anyone can add one with its bills. His answers: one owner per issue ("Issue owners can assign helpers"); a
// prepared issue has its wording and outlook checked, HIPHI's 2027 goal (staff-only for now) and talking points ("used
// for emails or testimonies"); the owner says keep, merge or retire; Nate approves; due Fri 6 Nov.
//
// Three places: My issues (#/outreach/issues?view=mine), the prep board for admins (?view=prep), and the prep card on an
// issue's own page, which is where every step is done. A new issue is a draft until an admin publishes it, and the card
// on a draft lists what it still needs instead (the database refuses to publish one that lacks any: issue_missing()).
import { S, DB, hooks, esc, advocate } from './data.js';
import { plain, legislativeDay } from './model.js';
import { icon, btn, iconBtn, chip, empty, toast, openSheet, closeSheet, notice, avatar, pickerSheet, menuSheet, confirmSheet, segmented } from './ui.js';
import { plural, afterClose } from './lists.js';

const live = () => (S.issues || []).filter(i => !i.archived_at);
const byName = (a, b) => a.name.localeCompare(b.name);
// Staff names are first names already ("May Rose" is one), so they are used whole.
const first = a => a?.full_name || 'Someone';
const isAdmin = () => !!S.me?.is_admin;
const now = () => new Date().toISOString();
export const isDraft = i => !!i && !i.published_at && !i.archived_at;
export const ownerOfIssue = i => advocate(i.owner_id);
export const helpersOf = i => (S.issueHelpers || []).filter(h => h.issue_id === i.id).map(h => advocate(h.advocate_id)).filter(Boolean);
const mayManage = i => isAdmin() || (S.me && i.owner_id === S.me.id);
const admins = () => S.advocates.filter(a => a.is_admin && a.is_active !== false);
// Who approves, in a sentence: "Nate", or "you" when the only admin is reading, or "an admin". Cap() starts a sentence.
const adminWord = () => { const a = admins(); return a.length !== 1 ? 'an admin' : a[0].id === S.me?.id ? 'you' : first(a[0]); };
const Cap = w => w.charAt(0).toUpperCase() + w.slice(1);

// "Fri 6 Nov", from app_settings 'issue_prep' (the day, in Hawaiʻi).
const dueDay = () => new Date(`${S.issuePrep?.due || '2026-11-06'}T12:00:00-10:00`);
export const dueText = () => { const d = dueDay(), o = { timeZone: 'Pacific/Honolulu' };
  return `${d.toLocaleDateString('en-US', { ...o, weekday: 'short' })} ${d.toLocaleDateString('en-US', { ...o, day: 'numeric' })} ${d.toLocaleDateString('en-US', { ...o, month: 'short' })}`; };
const pastDue = () => Date.now() > dueDay().getTime() + 12 * 3600e3;

// ---- the five steps of a prepared issue ----
const pointsOf = i => i.talking_points || [];
export const STEPS = [
  { k: 'wording', label: 'Name and description', todo: 'Check they still say it right', done: i => !!i.wording_checked_at, did: () => 'Checked' },
  { k: 'outlook', label: 'Between sessions', todo: 'Check what the public reads until January', done: i => !!i.outlook_checked_at, did: () => 'Checked' },
  { k: 'goal', label: 'HIPHI’s goal for 2027', todo: 'One or two sentences. Staff only', done: i => !!(i.goal || '').trim(), did: i => i.goal },
  { k: 'points', label: 'Talking points', todo: 'Three to five, for people’s letters', done: i => pointsOf(i).length >= 3, did: i => plural(pointsOf(i).length, 'point') },
  { k: 'plan', label: 'Keep, merge or retire', todo: 'What happens to it in 2027', done: i => !!i.proposal, did: i => i.proposal === 'merge' ? `Merge into ${S.issues.find(x => x.id === i.proposal_into)?.name || 'another issue'}` : i.proposal === 'retire' ? 'Retire it' : 'Keep it' },
];
const doneN = i => STEPS.filter(s => s.done(i)).length;
// The state people see: the database keeps todo, ready, approved and sent_back; "In progress" is any step done.
export function stateOf(i) {
  if (isDraft(i)) return 'draft';
  if (['approved', 'ready', 'sent_back'].includes(i.prep_state)) return i.prep_state;
  return doneN(i) ? 'started' : 'todo';
}
const STATE = { draft: ['Draft', '', 'eye-off'], todo: ['Not started', '', 'circle-dashed'], started: ['In progress', 'info', 'loader'],
  ready: ['Waiting for approval', 'warn', 'clock'], sent_back: ['Sent back', 'danger', 'undo-2'], approved: ['Approved', 'ok', 'circle-check'] };
export const stateChip = i => { const [l, tone, ic] = STATE[stateOf(i)]; return chip(l, tone, ic); };
const progress = i => `<span class="pr-dots" aria-hidden="true">${STEPS.map(s => `<span class="pr-dot${s.done(i) ? ' on' : ''}"></span>`).join('')}</span><span class="pr-n"><span class="sr">Steps done: </span>${doneN(i)}/${STEPS.length}</span>`;
// In a list the dots already say how far along it is, so a row names only the states they cannot show (A-14), plainly,
// with no pill, so only the owner button looks pressable (A-12).
const SAYS = new Set(['sent_back', 'ready', 'approved', 'draft']);
const rowState = i => { const k = stateOf(i); if (!SAYS.has(k)) return ''; const [l, tone, ic] = STATE[k]; return `<span class="pr-st${tone ? ' ' + tone : ''}">${icon(ic)}${esc(l)}</span>`; };

// What a draft still needs before it can be published: the database's own list (issue_missing, 091).
export function missing(i) {
  const m = [];
  if (!(i.description || '').trim()) m.push(['wording', 'a description']);
  if (!(i.goal || '').trim()) m.push(['goal', 'a goal']);
  if (pointsOf(i).length < 3) m.push(['points', 'three talking points']);
  if (!i.owner_id) m.push(['owner', 'an owner']);
  if (!(S.billIssues || []).some(x => x.issue_id === i.id)) m.push(['bill', 'a bill']);
  return m;
}

// My issues and the helpers I am on.
const mine = () => live().filter(i => S.me && i.owner_id === S.me.id && !isDraft(i));
const helping = () => { const ids = new Set((S.issueHelpers || []).filter(h => h.advocate_id === S.me?.id).map(h => h.issue_id)); return live().filter(i => ids.has(i.id) && i.owner_id !== S.me?.id); };
const myDrafts = () => live().filter(i => isDraft(i) && (i.owner_id === S.me?.id || i.created_by === S.me?.id));
const waitingForAdmin = () => live().filter(i => stateOf(i) === 'ready');

// ---- the notice on Today: one line, only when there is something for this person (today.js oneNotice) ----
export function todayPrepNotice() {
  if (!S.me || !(S.issues || []).length) return '';
  const wait = isAdmin() ? waitingForAdmin().length + live().filter(isDraft).length : 0;
  if (wait) return notice('info', 'clipboard-check', `<b>${plural(wait, 'issue')} waiting for you.</b> Approve ${wait === 1 ? 'it' : 'them'} or send ${wait === 1 ? 'it' : 'them'} back.`, btn('Review', { kind: 'secondary', href: '#/outreach/issues?view=prep&f=wait' }));
  const own = mine(), left = own.filter(i => !['ready', 'approved'].includes(stateOf(i)));
  if (!left.length) return '';
  const back = own.filter(i => stateOf(i) === 'sent_back').length;
  // After the due day the notice is for what came back, not a standing reminder (R-118: it had no end date).
  if (!back && Date.now() > dueDay().getTime() + 864e5) return '';
  return notice(back ? 'warn' : 'info', 'clipboard-list', `<b>Your issues for 2027:</b> ${own.length - left.length} of ${own.length} ready${back ? `, ${back} sent back` : ''}. Due ${esc(dueText())}.`, btn('My issues', { kind: 'secondary', href: '#/outreach/issues?view=mine' }));
}
// The two links under the Issues index heading.
export function indexLinks() {
  const own = mine(), help = helping();
  const a = own.length || help.length ? `<a class="is-fvlink" href="#/outreach/issues?view=mine">${icon('clipboard-list')}<span>My issues${own.length ? `: ${own.filter(i => ['ready', 'approved'].includes(stateOf(i))).length} of ${own.length} ready` : ''}</span></a>` : '';
  const ok = live().filter(i => !isDraft(i)), n = ok.filter(i => stateOf(i) === 'approved').length;
  const b = isAdmin() ? `<a class="is-fvlink" href="#/outreach/issues?view=prep">${icon('clipboard-check')}<span>Prep board: ${n} of ${ok.length} approved</span></a>` : '';
  return a || b ? `<div class="pr-links">${a}${b}</div>` : '';
}

// ---- a sheet for one field: goal, points, outlook, and name and description ----
function fieldSheet({ title, fields, help = '', saveLabel = 'Save', unchangedLabel = '', onSave }) {
  const body = `<div class="le-sheet is-form pr-sheet">${help ? `<p class="small muted is-for">${help}</p>` : ''}
    ${fields.map(f => `<div class="field"><label for="pr-${f.k}">${f.label}</label>
      ${f.rows ? `<textarea id="pr-${f.k}" rows="${f.rows}" maxlength="${f.max}" aria-describedby="pr-${f.k}-h pr-${f.k}-err"${f.ph ? ` placeholder="${esc(f.ph)}"` : ''}>${esc(f.value || '')}</textarea>`
        : `<input id="pr-${f.k}" maxlength="${f.max}" autocomplete="off" value="${esc(f.value || '')}" aria-describedby="pr-${f.k}-h pr-${f.k}-err">`}
      ${f.help ? `<span class="help" id="pr-${f.k}-h">${f.help}</span>` : ''}${f.count ? `<span class="help bw-count" id="pr-${f.k}-n" aria-live="polite"></span>` : ''}<div id="pr-${f.k}-err" role="alert"></div></div>`).join('')}</div>`;
  openSheet({ title, size: 'auto', body, foot: btn(unchangedLabel || saveLabel, { icon: 'check', attrs: { 'data-prsave': '1' } }),
    wire: d => {
      const go = d.querySelector('[data-prsave]'), els = Object.fromEntries(fields.map(f => [f.k, d.querySelector('#pr-' + f.k)]));
      const vals = () => Object.fromEntries(fields.map(f => [f.k, els[f.k].value]));
      const changed = () => fields.some(f => els[f.k].value.trim() !== String(f.value || '').trim());
      const paint = () => { if (unchangedLabel) go.lastChild.textContent = changed() ? saveLabel : unchangedLabel;
        for (const f of fields) if (f.count) d.querySelector(`#pr-${f.k}-n`).textContent = f.count(els[f.k].value); };
      for (const f of fields) els[f.k].oninput = () => { els[f.k].removeAttribute('aria-invalid'); d.querySelector(`#pr-${f.k}-err`).innerHTML = ''; paint(); };
      paint(); els[fields[0].k].focus();
      go.onclick = async () => {
        const v = vals();
        for (const f of fields) { const bad = f.check?.(v[f.k]); if (bad) { els[f.k].setAttribute('aria-invalid', 'true'); d.querySelector(`#pr-${f.k}-err`).innerHTML = `<span class="err">${icon('circle-alert')}${esc(bad)}</span>`; els[f.k].focus(); return; } }
        go.setAttribute('aria-busy', 'true'); go.disabled = true;
        try { await onSave(v, changed()); closeSheet({ silent: true }); hooks.render(); }
        catch (e) { toast(e, { err: true }); go.removeAttribute('aria-busy'); go.disabled = false; }
      };
    } });
}
const pointsIn = v => String(v || '').split('\n').map(s => s.trim().replace(/^[-•*]\s*/, '')).filter(Boolean);
const pointsCount = v => { const n = pointsIn(v).length; return n < 3 ? `${n} of 3 needed` : n > 5 ? `${n}: five at most` : `${n} points`; };

export function openStep(i, k) {
  if (k === 'wording') return fieldSheet({ title: 'Name and description', help: 'The public follows the issue by this name. Change anything that no longer fits, or say it looks right.',
    fields: [{ k: 'name', label: 'Name', value: i.name, max: 60, help: 'A policy people recognize, in everyday words.',
        check: v => { const nm = v.trim().replace(/\s+/g, ' '), clash = live().find(x => x.id !== i.id && plain(x.name) === plain(nm)); return nm.length < 2 ? 'Give the issue a name.' : clash ? `There is already an issue called “${clash.name}”.` : ''; } },
      { k: 'description', label: 'Description', value: i.description, rows: 3, max: 240, help: 'One sentence on what would change. The public sees it.' }],
    saveLabel: 'Save', unchangedLabel: 'Looks right',
    onSave: async (v, changed) => { await DB.updateIssue(i.id, { ...(changed ? { name: v.name.trim().replace(/\s+/g, ' '), description: v.description.trim() || null } : {}), wording_checked_at: now() });
      toast(changed ? 'Saved. The public page shows the new wording.' : 'Marked as checked.', { ok: true }); } });
  if (k === 'outlook') return fieldSheet({ title: 'Between sessions',
    fields: [{ k: 'outlook', label: 'What the public reads until January', value: i.outlook, rows: 4, max: 300, help: 'Shown from May to January under the issue on Home and on its page. Claude drafted the first ones from the bills’ records; add HIPHI’s plans if you like.' }],
    saveLabel: 'Save', unchangedLabel: 'Looks right',
    onSave: async (v, changed) => { const out = v.outlook.trim().replace(/\s+/g, ' ') || null;
      await DB.updateIssue(i.id, { ...(changed ? { outlook: out, outlook_edited_at: now() } : {}), outlook_checked_at: now() });
      toast(changed ? 'Saved. The public page shows it.' : 'Marked as checked.', { ok: true }); } });
  if (k === 'goal') return fieldSheet({ title: 'HIPHI’s goal for 2027',
    fields: [{ k: 'goal', label: 'What we want to win on this issue this session', value: i.goal, rows: 3, max: 600, help: 'Staff only for now: the public does not see it.', check: v => v.trim() ? '' : 'Write the goal, or close this to come back later.' }],
    onSave: async v => { await DB.updateIssue(i.id, { goal: v.goal.trim() }); toast('Goal saved.', { ok: true }); } });
  if (k === 'points') return fieldSheet({ title: 'Talking points',
    fields: [{ k: 'points', label: 'One point per line, three to five', value: pointsOf(i).join('\n'), rows: 6, max: 1100, ph: 'One plain sentence per line.',
      help: 'People writing testimony or emailing a legislator tap these into a letter sent in their own name, so keep them true. Each bill put on this issue starts with a copy, which its owner can change.',
      count: pointsCount, check: v => { const p = pointsIn(v); return p.length < 3 ? 'Write at least three points.' : p.length > 5 ? 'Five points at most.' : p.some(x => x.length > 200) ? 'Keep each point under 200 characters.' : ''; } }],
    onSave: async v => { await DB.updateIssue(i.id, { talking_points: pointsIn(v.points), talking_points_edited_at: now() }); toast('Talking points saved.', { ok: true }); } });
  if (k === 'plan') return pickerSheet({ title: 'In 2027, this issue should…', value: i.proposal || '',
    help: `Nothing changes until ${esc(adminWord())} approve${adminWord() === 'you' ? '' : 's'} it.`,
    options: [['keep', 'Stay as it is', 'check', 'With the wording you checked'], ['merge', 'Merge into another issue', 'arrow-right', 'Its bills and followers move over'], ['retire', 'Retire', 'archive', 'No longer an issue for HIPHI; its followers stop getting its bills']],
    onPick: async v => {
      if (v === 'merge') { await afterClose(); return mergePick(i); }
      try { await DB.updateIssue(i.id, { proposal: v, proposal_into: null }); hooks.render(); toast(v === 'retire' ? 'Marked to retire, once approved.' : 'Marked to keep.', { ok: true }); } catch (e) { toast(e, { err: true }); }
    } });
}
function mergePick(i) {
  let q = '';
  const list = () => { const t = plain(q.trim()); const l = live().filter(x => x.id !== i.id && !isDraft(x) && (!t || plain(x.name).includes(t))).sort((a, b) => (a.category === i.category ? 0 : 1) - (b.category === i.category ? 0 : 1) || byName(a, b)).slice(0, 30);
    return l.length ? `<div class="sv-pickl">${l.map(x => `<button type="button" data-into="${esc(x.id)}"><span class="body"><span class="title">${esc(x.name)}</span></span></button>`).join('')}</div>` : '<p class="le-none">No other issue matches.</p>'; };
  openSheet({ title: `Merge ${esc(i.name)} into…`, pop: true,
    body: `<p class="small muted is-for">Pick the issue to keep. Nothing moves until ${esc(adminWord())} approve${adminWord() === 'you' ? '' : 's'}.</p><div class="le-search is-psearch">${icon('search')}<input id="pr-mq" type="search" placeholder="Find the issue to keep" autocomplete="off" aria-label="Find the issue to keep"></div><div id="pr-mlist">${list()}</div>`,
    wire: d => {
      const box = d.querySelector('#pr-mlist');
      const wireList = () => box.querySelectorAll('[data-into]').forEach(el => el.onclick = async () => {
        try { await DB.updateIssue(i.id, { proposal: 'merge', proposal_into: el.dataset.into }); closeSheet({ silent: true }); hooks.render(); toast('Marked to merge, once approved.', { ok: true }); } catch (e) { toast(e, { err: true }); }
      });
      wireList(); d.querySelector('#pr-mq').oninput = e => { q = e.target.value; box.innerHTML = list(); wireList(); };
    } });
}

// ---- owner and helpers ----
const staffList = (skip = []) => S.advocates.filter(a => a.is_active !== false && !skip.includes(a.id)).sort((a, b) => a.full_name.localeCompare(b.full_name));
export function changeOwner(i, { after = () => hooks.render() } = {}) {
  pickerSheet({ title: `Owner of ${esc(i.name)}`, value: i.owner_id || '', help: 'One owner. They check the issue, and its new bills are theirs to lead unless someone already does.',
    options: staffList().map(a => [a.id, a.full_name, '', a.auth_user_id === null ? 'Cannot sign in yet' : '']),
    onPick: async id => {
      const was = i.owner_id; if (id === was) return;
      try { await DB.updateIssue(i.id, { owner_id: id }); after();
        toast(`${first(advocate(id))} owns ${i.name}.`, { undo: async () => { await DB.updateIssue(i.id, { owner_id: was }); after(); } }); }
      catch (e) { toast(e, { err: true }); }
    } });
}
function addHelper(i) {
  const skip = [i.owner_id, ...helpersOf(i).map(a => a.id)];
  pickerSheet({ title: 'Add a helper', help: 'A helper sees this issue in their own list and can fill in any step. Only the owner marks it ready.',
    options: staffList(skip).map(a => [a.id, a.full_name, '', a.auth_user_id === null ? 'Cannot sign in yet' : '']),
    onPick: async id => { try { await DB.addIssueHelper(i.id, id); hooks.render(); toast(`${first(advocate(id))} is helping. They get a Slack message.`, { ok: true }); } catch (e) { toast(e, { err: true }); } } });
}
function helperMenu(i, a) {
  const self = a.id === S.me?.id;
  menuSheet({ title: esc(a.full_name), items: [
    { label: self ? 'Stop helping' : 'Remove as helper', icon: 'user-minus', danger: true, disabled: !(self || mayManage(i)), reason: 'Only the owner or an admin can.',
      run: async () => { try { await DB.removeIssueHelper(i.id, a.id); hooks.render(); toast(self ? 'You are no longer helping.' : `${first(a)} is no longer helping.`, { undo: async () => { await DB.addIssueHelper(i.id, a.id); hooks.render(); } }); } catch (e) { toast(e, { err: true }); } } },
  ] });
}

// ---- the card on an issue's page ----
function peopleHTML(i) {
  const o = ownerOfIssue(i), hs = helpersOf(i);
  return `<div class="pr-people">
    <div class="pr-who"><span class="pr-wl">Owner</span>${o ? `${avatar(o, 24)}<span>${esc(o.id === S.me?.id ? 'You' : o.full_name)}</span>` : '<span class="muted">Nobody yet</span>'}
      ${mayManage(i) ? btn(o ? 'Change' : 'Choose', { kind: 'text', sm: true, attrs: { 'data-pr': 'owner', 'aria-label': 'Change the owner' } }) : ''}</div>
    <div class="pr-who"><span class="pr-wl">Helpers</span>${hs.map(a => `<button type="button" class="pr-helper" data-prh="${esc(a.id)}" aria-haspopup="dialog">${avatar(a, 24)}<span>${esc(a.id === S.me?.id ? 'You' : first(a))}</span></button>`).join('') || (mayManage(i) ? '' : '<span class="muted">None</span>')}
      ${mayManage(i) ? btn('Add', { kind: 'text', sm: true, icon: 'plus', attrs: { 'data-pr': 'helper', 'aria-label': 'Add a helper' } }) : ''}</div>
  </div>`;
}
function stepsHTML(i, steps) {
  return `<ol class="pr-steps">${steps.map(s => { const d = s.done(i), sub = d ? s.did(i) : s.todo;
    return `<li><button type="button" class="pr-step${d ? ' done' : ''}" data-prstep="${s.k}">${icon(d ? 'circle-check' : 'circle', { cls: 'pr-mark' })}
      <span class="body"><span class="title">${esc(s.label)}</span><span class="sub">${esc(sub)}</span></span><span class="pr-go">${d ? 'Change' : 'Do it'}</span></button></li>`; }).join('')}</ol>`;
}
export function prepCardHTML(i) {
  if (!i || i.archived_at) return '';
  if (isDraft(i)) {
    const m = missing(i), who = adminWord();
    return `<section class="card pr-card pr-draft" aria-labelledby="pr-h">
      <div class="pr-head"><h2 id="pr-h">Before it goes public</h2>${chip('Draft', '', 'eye-off')}</div>
      <p class="small pr-lede">The public does not see this issue yet. ${m.length ? `It still needs ${esc(listWords(m.map(x => x[1])))}.` : `It has everything. ${isAdmin() ? 'Publish it when you are happy with it.' : `${esc(Cap(who))} publish${who === 'you' ? '' : 'es'} it.`}`}</p>
      ${peopleHTML(i)}
      ${stepsHTML(i, [STEPS[0], STEPS[2], STEPS[3]].map(s => s.k === 'wording' ? { ...s, label: 'Description', todo: 'One sentence the public sees', done: x => !!(x.description || '').trim(), did: x => x.description } : s))}
      ${isAdmin() ? `<div class="pr-foot">${btn('Publish', { icon: 'globe', attrs: { 'data-pr': 'publish', ...(m.length ? { 'aria-disabled': 'true' } : {}) } })}${m.length ? `<span class="small muted">Needs ${esc(listWords(m.map(x => x[1])))} first.</span>` : ''}</div>` : ''}
    </section>`;
  }
  const st = stateOf(i), n = doneN(i), owner = S.me && i.owner_id === S.me.id, by = advocate(i.prep_by);
  const note = st === 'sent_back' ? notice('warn', 'undo-2', `<b>${esc(first(by))} sent it back:</b> ${esc(i.prep_note || '')}`)
    : st === 'approved' ? notice('ok', 'circle-check', `<b>Approved${by ? ` by ${esc(first(by))}` : ''}.</b>${i.prep_note ? ` ${esc(i.prep_note)}` : ''}`, isAdmin() ? btn('Undo', { kind: 'text', attrs: { 'data-pr': 'undo' } }) : '') : '';
  let foot = '';
  if (st === 'ready') foot = isAdmin()
    ? `${btn('Approve', { icon: 'check', attrs: { 'data-pr': 'approve' } })}${btn('Send back', { kind: 'secondary', attrs: { 'data-pr': 'sendback', 'aria-haspopup': 'dialog' } })}${owner ? btn('Not ready yet', { kind: 'text', attrs: { 'data-pr': 'unready' } }) : ''}`
    : `<span class="small">Waiting for ${esc(adminWord())} to approve it.</span>${owner ? btn('Not ready yet', { kind: 'text', attrs: { 'data-pr': 'unready' } }) : ''}`;
  else if (st !== 'approved' && (owner || isAdmin())) foot = `${btn('Mark ready', { icon: 'send', attrs: { 'data-pr': 'ready', ...(n < STEPS.length ? { 'aria-disabled': 'true' } : {}) } })}<span class="small muted">${n < STEPS.length ? `${STEPS.length - n} step${STEPS.length - n === 1 ? '' : 's'} left.` : `${esc(Cap(adminWord()))} approve${adminWord() === 'you' ? '' : 's'} it next.`}</span>`;
  else if (st !== 'approved') foot = `<span class="small muted">${esc(first(ownerOfIssue(i)))} marks it ready.</span>`;
  const inner = `<p class="small pr-lede">Due ${esc(dueText())}</p>
    ${note}${peopleHTML(i)}${stepsHTML(i, STEPS)}
    ${foot ? `<div class="pr-foot">${foot}</div>` : ''}`;
  // Session work first (R-118): once the issue is approved, or the session is under way, the card folds to one line and
  // the issue's bills come first on its page.
  if (st === 'approved' || legislativeDay()) return `<details class="card pr-card pr-fold"><summary><span class="pr-foldt">${icon('clipboard-check')}<b>Getting ready for 2027</b>${SAYS.has(st) ? stateChip(i) : ''}</span>${icon('chevron-down', { cls: 'chev' })}</summary>${inner}</details>`;
  return `<section class="card pr-card" aria-labelledby="pr-h">
    <div class="pr-head"><h2 id="pr-h">Getting ready for 2027</h2>${SAYS.has(st) ? stateChip(i) : ''}</div>
    ${inner}
  </section>`;
}
const listWords = l => l.length < 2 ? l.join('') : `${l.slice(0, -1).join(', ')} and ${l[l.length - 1]}`;

export function wirePrepCard(i, root) {
  const card = root.querySelector('.pr-card'); if (!card || !i) return;
  card.querySelectorAll('[data-prstep]').forEach(el => el.onclick = () => openStep(i, el.dataset.prstep));
  card.querySelectorAll('[data-prh]').forEach(el => el.onclick = () => { const a = advocate(el.dataset.prh); if (a) helperMenu(i, a); });
  const on = (k, fn) => card.querySelector(`[data-pr="${k}"]`)?.addEventListener('click', fn);
  on('owner', () => changeOwner(i));
  on('helper', () => addHelper(i));
  on('ready', async e => {
    if (e.currentTarget.getAttribute('aria-disabled') === 'true') { const left = STEPS.filter(s => !s.done(i)); toast(`Still to do: ${left.map(s => s.label.toLowerCase()).join(', ')}.`); openStep(i, left[0].k); return; }
    try { await DB.updateIssue(i.id, { prep_state: 'ready' }); hooks.render(); toast(`Marked ready. ${Cap(adminWord())} approve${adminWord() === 'you' ? '' : 's'} it next.`, { ok: true, undo: async () => { await DB.updateIssue(i.id, { prep_state: 'todo' }); hooks.render(); } }); }
    catch (err) { toast(err, { err: true }); }
  });
  on('unready', async () => { try { await DB.updateIssue(i.id, { prep_state: 'todo' }); hooks.render(); toast('Taken back. Mark it ready again when it is.'); } catch (err) { toast(err, { err: true }); } });
  on('approve', () => approve(i));
  on('sendback', () => sendBack(i));
  on('undo', async () => { try { await DB.reviewIssue(i.id, 'undo'); hooks.render(); toast('Approval undone. It is waiting for approval again.'); } catch (err) { toast(err, { err: true }); } });
  on('publish', async e => {
    const m = missing(i);
    if (m.length) { toast(`It needs ${listWords(m.map(x => x[1]))} first.`); const k = m[0][0]; if (k === 'owner') changeOwner(i); else if (k === 'bill') document.getElementById('is-bq')?.focus(); else openStep(i, k); return; }
    const ok = await confirmSheet({ title: `Publish ${esc(i.name)}?`, ok: 'Publish', text: 'The public can find and follow it from now on. People who follow its whole category get it too.' });
    if (!ok) return;
    // Publishing is the admin's approval of the whole issue, so its prep steps count as done too.
    const at = now();
    try { await DB.updateIssue(i.id, { published_at: at, prep_state: 'approved', wording_checked_at: i.wording_checked_at || at, outlook_checked_at: i.outlook_checked_at || at, proposal: 'keep', proposal_into: null }); hooks.render(); toast(`${i.name} is public.`, { ok: true }); }
    catch (err) { toast(err, { err: true }); }
    void e;
  });
}
async function approve(i) {
  const into = i.proposal === 'merge' ? S.issues.find(x => x.id === i.proposal_into) : null;
  if (i.proposal === 'merge' || i.proposal === 'retire') {
    const ok = await confirmSheet({ title: i.proposal === 'merge' ? `Approve and merge into ${esc(into?.name || 'the other issue')}?` : `Approve and retire ${esc(i.name)}?`, ok: i.proposal === 'merge' ? 'Approve and merge' : 'Approve and retire', danger: true,
      text: i.proposal === 'merge' ? `${esc(i.name)}’s bills and followers move to ${esc(into?.name || 'it')}, and ${esc(i.name)} is archived. A merge cannot be undone from here.` : 'The public stops seeing it, and its followers stop getting its bills. You can restore it from Issues, under Archived.' });
    if (!ok) return;
  }
  try {
    await DB.reviewIssue(i.id, 'approve'); hooks.render();
    const canUndo = !['merge', 'retire'].includes(i.proposal);
    toast(i.owner_id && i.owner_id !== S.me?.id ? `Approved. ${first(ownerOfIssue(i))} gets a Slack message.` : 'Approved.', { ok: true, ...(canUndo ? { undo: async () => { await DB.reviewIssue(i.id, 'undo'); hooks.render(); } } : {}) });
  } catch (e) { toast(e, { err: true }); }
}
function sendBack(i) {
  fieldSheet({ title: `Send back ${esc(i.name)}`, saveLabel: 'Send back',
    fields: [{ k: 'note', label: 'What needs changing', rows: 3, max: 600, help: `${esc(first(ownerOfIssue(i)))} gets it in Slack and sees it on the issue.`, check: v => v.trim() ? '' : 'Say what needs changing, so the owner knows.' }],
    onSave: async v => { await DB.reviewIssue(i.id, 'send_back', v.note.trim()); toast('Sent back.', { ok: true }); } });
}

// A sub-page of Issues, like the first visit's (firstvisit.js): the way back, and a heading of its own.
const subHead = (title, lede) => `<a class="le-deskback" href="#/outreach/issues" data-back>${icon('chevron-left')}<span>Issues</span></a>
  <header class="pr-top"><h1>${title}</h1><p class="le-lede">${lede}</p></header>`;

// ---- My issues (?view=mine) ----
const ORDER = { sent_back: 0, started: 1, todo: 2, ready: 3, approved: 4, draft: 5 };
function prepRow(i, { owner = false } = {}) {
  const o = ownerOfIssue(i);
  return `<li class="pr-row"><a class="pr-main" href="#/issue/${encodeURIComponent(i.id)}">
      <span class="title">${esc(i.name)}</span>
      <span class="sub">${progress(i)}${owner ? `<span class="pr-owner">${o ? esc(first(o)) : 'No owner'}</span>` : ''}</span></a>
    <span class="pr-end">${rowState(i)}</span></li>`;
}
function mineRender() {
  const own = mine().sort((a, b) => ORDER[stateOf(a)] - ORDER[stateOf(b)] || byName(a, b)), help = helping().sort(byName), drafts = myDrafts();
  const ready = own.filter(i => ['ready', 'approved'].includes(stateOf(i))).length;
  const lede = own.length ? `${ready} of ${own.length} ready. Due ${esc(dueText())}${pastDue() ? ' (past due)' : ''}.` : 'Getting the issues ready for 2027.';
  const next = own.find(i => !['ready', 'approved'].includes(stateOf(i)));
  return `<div class="le-page pr-page">
    ${subHead('My issues', lede)}
    ${next ? `<div class="pr-next">${btn(`Next: ${esc(next.name)}`, { iconEnd: 'arrow-right', href: '#/issue/' + encodeURIComponent(next.id) })}</div>` : ''}
    ${!own.length && !help.length && !drafts.length ? `<div class="le-empty">${empty({ title: 'No issues are yours yet', text: `${esc(Cap(adminWord()))} give${adminWord() === 'you' ? '' : 's'} out the issues. Any you own or help on show here.`, action: btn('See all issues', { kind: 'secondary', href: '#/outreach/issues' }) })}</div>` : ''}
    ${own.length ? `<section class="le-sec" aria-labelledby="pr-mine"><div class="le-sechead"><h2 id="pr-mine">Yours</h2></div><ul class="rows pr-rows">${own.map(i => prepRow(i)).join('')}</ul></section>` : ''}
    ${help.length ? `<section class="le-sec" aria-labelledby="pr-help"><div class="le-sechead"><h2 id="pr-help">Helping</h2><span class="meta">${plural(help.length, 'issue')}</span></div><ul class="rows pr-rows">${help.map(i => prepRow(i, { owner: true })).join('')}</ul></section>` : ''}
    ${drafts.length ? `<section class="le-sec" aria-labelledby="pr-dr"><div class="le-sechead"><h2 id="pr-dr">Your drafts</h2><span class="meta">not public yet</span></div><ul class="rows pr-rows">${drafts.map(i => prepRow(i)).join('')}</ul></section>` : ''}
  </div>`;
}

// ---- the prep board (?view=prep): every issue, its owner, its steps, and what is waiting for an admin ----
const FILTERS = [['all', 'All'], ['wait', 'Waiting for you'], ['sent_back', 'Sent back'], ['todo', 'Not started'], ['draft', 'Drafts']];
const inFilter = (i, f) => f === 'all' ? !isDraft(i) : f === 'wait' ? stateOf(i) === 'ready' : f === 'draft' ? isDraft(i) : stateOf(i) === f;
const B = () => S.prBoard ??= { f: null, who: null };
function boardRow(i) {
  const o = ownerOfIssue(i);
  return `<li class="pr-row pr-brow"><a class="pr-main" href="#/issue/${encodeURIComponent(i.id)}"><span class="title">${esc(i.name)}</span><span class="sub">${isDraft(i) ? '' : progress(i)}</span></a>
    <button type="button" class="pr-ownbtn" data-prown="${esc(i.id)}" aria-haspopup="dialog" aria-label="Owner of ${esc(i.name)}: ${esc(o?.full_name || 'nobody')}. Change">${avatar(o, 24)}<span>${esc(o ? first(o) : 'Nobody')}</span>${icon('chevron-down', { cls: 'chev' })}</button>
    <span class="pr-end">${rowState(i)}</span></li>`;
}
function boardBody(f, who) {
  const rows = live().filter(i => inFilter(i, f) && (!who || i.owner_id === who));
  if (!rows.length) return `<p class="le-none">${f === 'wait' ? 'Nothing is waiting for you.' : f === 'draft' ? 'No drafts.' : 'None.'}</p>`;
  return (S.categories || []).map(c => { const l = rows.filter(i => i.category === c.key).sort(byName); return l.length ? `<section class="pr-cat" aria-labelledby="pr-c-${esc(c.key)}"><div class="le-sechead"><h2 id="pr-c-${esc(c.key)}">${esc(c.name)}</h2><span class="meta">${plural(l.length, 'issue')}</span></div><ul class="rows pr-rows">${l.map(boardRow).join('')}</ul></section>` : ''; }).join('');
}
function tellHTML() {
  const untold = live().filter(i => i.owner_id && !i.owner_told_at && !isDraft(i)), people = [...new Set(untold.map(i => i.owner_id))].map(advocate).filter(Boolean);
  const others = people.filter(a => a.id !== S.me?.id), noLogin = others.filter(a => a.auth_user_id === null);
  const told = live().some(i => i.owner_told_at);
  if (!others.length) return told ? `<p class="small muted pr-told">${icon('check')}Owners have been told. A new owner hears as soon as you change one.</p>` : '';
  return `<section class="card pr-tell" aria-labelledby="pr-th"><h2 id="pr-th">${told ? `${plural(others.length, 'owner')} not told yet` : 'Nobody has been told yet'}</h2>
    <p class="small">When the owners look right, tell them. Each gets one Slack message listing their issues and the due date. ${noLogin.length ? `<b>${esc(listWords(noLogin.map(first)))} cannot sign in yet</b>: make ${noLogin.length === 1 ? 'them a sign-in link' : 'each a sign-in link'} under <a href="#/setup/team">Session setup, Team</a> first, or they cannot open the link.` : ''} Someone the tracker cannot reach is not sent one; Team shows who.</p>
    ${btn(`Tell ${plural(others.length, 'owner')}`, { icon: 'send', attrs: { 'data-pr': 'tell' } })}</section>`;
}
function boardRender(route) {
  const st = B(); if (route.q?.f && FILTERS.some(x => x[0] === route.q.f)) st.f = route.q.f;
  const ok = live().filter(i => !isDraft(i)), counts = k => live().filter(i => inFilter(i, k) && (!st.who || i.owner_id === st.who)).length, n = ok.filter(i => stateOf(i) === 'approved').length;
  // Until someone picks a filter: what is waiting for the admin if anything is, otherwise everything.
  const f = st.f || (counts('wait') ? 'wait' : 'all');
  const per = {}; for (const i of ok) if (i.owner_id) per[i.owner_id] = (per[i.owner_id] || 0) + 1;
  const perLine = Object.entries(per).sort((a, b) => b[1] - a[1]).map(([id, c]) => `<button type="button" class="pr-whob" data-prwho="${esc(id)}" aria-pressed="${st.who === id}">${esc(first(advocate(id)))} ${c}</button>`).join('');
  return `<div class="le-page pr-page pr-board">
    ${subHead('Prep board', `${n} of ${ok.length} approved · due ${esc(dueText())}. Owners work through their issues and mark them ready; you approve or send back.`)}
    ${isAdmin() ? tellHTML() : ''}
    ${perLine ? `<div class="pr-per" role="group" aria-label="Show one owner's issues"><span class="small muted">Owners</span>${perLine}${st.who ? btn('Everyone', { kind: 'text', sm: true, attrs: { 'data-prwho': '' } }) : ''}</div>` : ''}
    <div class="pr-filters">${segmented('prf', FILTERS.map(([k, l]) => [k, `${l}${k === 'all' ? '' : ` (${counts(k)})`}`]), f, 'Show')}</div>
    <div id="pr-body">${boardBody(f, st.who)}</div>
  </div>`;
}

export const prepView = route => ({ mine: 'mine', prep: 'prep' })[route?.q?.view] || null;
export const prepTitle = route => ({ mine: 'My issues', prep: 'Prep board' })[prepView(route)] || '';
export const renderPrep = route => prepView(route) === 'mine' ? mineRender() : boardRender(route);
export function wirePrep(route, root) {
  if (prepView(route) !== 'prep') return;
  const st = B();
  const wireRows = () => root.querySelectorAll('[data-prown]').forEach(el => el.onclick = () => { const i = S.issues.find(x => x.id === el.dataset.prown); if (i) changeOwner(i); });
  root.querySelectorAll('[data-seg="prf"]').forEach(el => el.onclick = () => { st.f = el.dataset.val; hooks.render(); });
  root.querySelectorAll('[data-prwho]').forEach(el => el.onclick = () => { const id = el.dataset.prwho || null; st.who = st.who === id ? null : id; if (st.who) st.f = 'all'; hooks.render(); });
  wireRows();
  root.querySelector('[data-pr="tell"]')?.addEventListener('click', async e => {
    const b = e.currentTarget; b.setAttribute('aria-busy', 'true'); b.disabled = true;
    // M1-1: say how many were actually sent a message, and name anyone the tracker could not reach.
    const asked = [...new Set(live().filter(i => i.owner_id && !i.owner_told_at && !isDraft(i)).map(i => i.owner_id))].filter(id => id !== S.me?.id);
    try { const n = await DB.tellIssueOwners(); hooks.render();
      let lost = []; try { const r = await DB.teamReach(); lost = asked.filter(id => !['slack', 'email', 'unknown'].includes(r.find(x => x.advocate_id === id)?.reach)).map(advocate).filter(Boolean); } catch {}
      toast(`Sent to ${plural(n, 'owner')}. Each shows as told once their message arrives.${lost.length ? ` Not sent to ${listWords(lost.map(first))}: the tracker can't reach them (Session setup, Team).` : ''}`, { ok: !lost.length }); }
    catch (err) { toast(err, { err: true }); b.removeAttribute('aria-busy'); b.disabled = false; }
  });
}
