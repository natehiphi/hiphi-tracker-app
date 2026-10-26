// Getting the issues ready for 2027 (backend 091, REQUESTS R-088, backend docs/PREP-2027-PLAN.md). Nate 9/29: staff are
// "easily assigned different issues now" to "prepare materials for the 2027 launch", and "as new issues pop up throughout
// session" anyone can add one with its bills. His answers: one owner per issue ("Issue owners can assign helpers"); a
// prepared issue has its wording and outlook checked, HIPHI's 2027 goal (staff-only for now) and talking points ("used
// for emails or testimonies"); the owner says keep, merge or retire; Nate approves; due Fri 6 Nov.
//
// Three places: My issues between sessions (the prep list, W16), the Prep board for admins (All issues › Prep board,
// #/my-issues/all?view=prep, F165), and the prep card on an issue's own page, which is where every step is done. A new
// issue is a draft until an admin publishes it, and the card on a draft lists what it still needs instead (the database
// refuses to publish one that lacks any: issue_missing()).
//
// v6 (R-336 spec 6, V30): the steps run inline on the card, with no sheet to open first. Each step still to do shows its
// own control on the card: "Looks right" for the public wording and the between-sessions text (Edit opens the sheet), a
// box that saves as you type for the goal and the talking points (B-7: it says Saving, Saved), and the answers to "Top
// issue?" and "Keep, merge or retire" as buttons. Done steps fold to one line with Change. The card's foot is sticky:
// "Mark ready and open the next" walks the owner's list, so one issue is at most 8 clicks from Today (v5: 14, X26).
// A helper cannot mark an issue ready, so when the six steps are done their part is done: the card says "Your part is
// done" and opens their next issue, never one already finished (X26). A prep date that has passed is "Still to finish",
// in plain words with no red (spec 6, D3): nobody can act on a date, only on the steps.
import { S, DB, DEMO, SESSION_OVER, hooks, esc, advocate } from './data.js';
import { plain, legislativeDay } from './model.js';
import { teamName, ownerName } from './model.js';   // R-316 W28
import { icon, btn, empty, toast, openSheet, closeSheet, avatar, pickerSheet, menuSheet, confirmSheet, filterBtn, friendly } from './ui.js';
import { plural, afterClose } from './lists.js';
import { itemRow, statusTile, nw, dayWords } from './steps.js';
import { headHTML } from './issuestand.js';

const live = () => (S.issues || []).filter(i => !i.archived_at);
const byName = (a, b) => a.name.localeCompare(b.name);
// Staff names are first names already ("May Rose" is one), so they are used whole.
// R-316 W28 (G3-8): an owner or helper who is turned off says so: "Lauren (turned off)" (model.js teamName).
const first = a => teamName(a);
const isAdmin = () => !!S.me?.is_admin;
const now = () => new Date().toISOString();
export const isDraft = i => !!i && !i.published_at && !i.archived_at;
export const ownerOfIssue = i => advocate(i.owner_id);
export const helpersOf = i => (S.issueHelpers || []).filter(h => h.issue_id === i.id).map(h => advocate(h.advocate_id)).filter(Boolean);
const mayManage = i => isAdmin() || (S.me && i.owner_id === S.me.id);
const isOwner = i => !!S.me && i.owner_id === S.me.id;
const isHelper = i => !!S.me && !isOwner(i) && (S.issueHelpers || []).some(h => h.issue_id === i.id && h.advocate_id === S.me.id);
// Who works the steps on the card: the owner, a helper, an admin. Anyone else reads where it stands.
const canWork = i => isAdmin() || isOwner(i) || isHelper(i);
const admins = () => S.advocates.filter(a => a.is_admin && a.is_active !== false);
// Who approves, in a sentence: "Nate", or "you" when the only admin is reading, or "an admin". Cap() starts a sentence.
const adminWord = () => { const a = admins(); return a.length !== 1 ? 'an admin' : a[0].id === S.me?.id ? 'you' : first(a[0]); };
const Cap = w => w.charAt(0).toUpperCase() + w.slice(1);
const approves = () => `${Cap(adminWord())} approve${adminWord() === 'you' ? '' : 's'}`;

// "Fri 11/6", from app_settings 'issue_prep' (the day, in Hawaiʻi), in the app's one date format (steps.js dayWords; the
// critic: "Due Fri 6 Nov" was the only date written another way).
const dueDay = () => new Date(`${S.issuePrep?.due || '2026-11-06'}T12:00:00-10:00`);
export const dueText = () => dayWords(dueDay());
const pastDue = () => Date.now() > dueDay().getTime() + 12 * 3600e3;
// The last second of the due day, in Hawaiʻi: when Today's prep task turns "Still to finish" (R-316 W4; steps.js status).
export const dueEnd = () => dueDay().getTime() + 12 * 3600e3 - 1000;
// "today", "tomorrow", "Fri" within the week, else "Fri 11/6".
const dueWord = () => { const h = d => new Date(d).toLocaleDateString('en-CA', { timeZone: 'Pacific/Honolulu' }), day = h(dueDay()), t = Date.now();
  return day === h(t) ? 'today' : day === h(t + 864e5) ? 'tomorrow' : dueEnd() > t && dueEnd() - t < 6 * 864e5 ? dueDay().toLocaleDateString('en-US', { timeZone: 'Pacific/Honolulu', weekday: 'short' }) : dueText(); };
// The due date in words that never alarm (spec 6): "Due Fri 11/6", or once past it "Still to finish · it was due Fri 11/6".
const dueSay = () => pastDue() ? `Still to finish · it was due ${dueText()}` : `Due ${dueWord() === dueText() ? dueText() : `${dueWord()}, ${dueText()}`}`;
const clip = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).replace(/\s\S*$/, '') + '…' : s; };

// R-316 (Nate's whole review of Staff v5, 21 Oct). On the practice copy only until he says yes: W4, the prep as a task on
// everyone's Today and, for admins, one line naming who is behind; W17, an admin approving the issues they own without
// marking them ready first (review_issue('approve') does not need the ready state, 091).
export const PREP_TODAY = () => DEMO;
const SELF_APPROVE = () => DEMO;

// ---- the six steps of a prepared issue (R-288 added "Top issue for 2027?") ----
const pointsOf = i => i.talking_points || [];
// Each step's one instruction (the critic: five lines of small print on one card; one a step, and Saving/Saved says the rest).
export const STEPS = [
  { k: 'wording', label: 'Name and description', todo: 'Do the name and the description above still say it right?', done: i => !!i.wording_checked_at, did: () => 'Checked' },
  { k: 'outlook', label: 'Between sessions', todo: 'What the public reads until January: does it still hold?', done: i => !!i.outlook_checked_at, did: i => i.outlook ? `Checked: ${i.outlook}` : 'Checked' },
  { k: 'goal', label: 'HIPHI’s goal for 2027', todo: 'One or two sentences. Staff only.', done: i => !!(i.goal || '').trim(), did: i => i.goal },
  { k: 'points', label: 'Talking points', todo: 'Three to five, one a line. People put them in letters sent in their own name, so keep them true.', done: i => pointsOf(i).length >= 3, did: i => plural(pointsOf(i).length, 'point') },
  { k: 'top', label: 'Top issue for 2027?', todo: () => `Should HIPHI lead with it? ${Cap(adminWord())} confirm${adminWord() === 'you' ? '' : 's'} it, and newcomers find it already ticked.`, done: i => !!i.top_pick, did: i => i.top_pick === 'no' ? 'No' : i.recommended ? 'Yes, confirmed' : `Yes, waiting for ${adminWord()} to confirm` },
  { k: 'plan', label: 'Keep, merge or retire', todo: () => `What happens to it in 2027. Nothing changes until ${adminWord()} approve${adminWord() === 'you' ? '' : 's'} it.`, done: i => !!i.proposal, did: i => i.proposal === 'merge' ? `Merge into ${S.issues.find(x => x.id === i.proposal_into)?.name || 'another issue'}` : i.proposal === 'retire' ? 'Retire it' : 'Keep it' },
];
const todoOf = s => typeof s.todo === 'function' ? s.todo() : s.todo;
const doneN = i => STEPS.filter(s => s.done(i)).length;
// A helper's part (no migration records one, D13): the materials, HIPHI's goal and the talking points. The public wording,
// the top-issue answer and keep, merge or retire are the owner's to decide, and only the owner marks the issue ready. A
// helper's steps say "Your part", the rest say whose they are, and the part closes "Your part is done" (spec 6; Julie read
// six "To do · Open" lines and nothing said which were hers).
const HELP_PART = ['goal', 'points'];
const partSteps = () => STEPS.filter(s => HELP_PART.includes(s.k));
const partDone = i => partSteps().every(s => s.done(i));
const partWords = () => listWords(partSteps().map(s => s.label));
// The state people see: the database keeps todo, ready, approved and sent_back; "In progress" is any step done.
export function stateOf(i) {
  if (isDraft(i)) return 'draft';
  if (['approved', 'ready', 'sent_back'].includes(i.prep_state)) return i.prep_state;
  return doneN(i) ? 'started' : 'todo';
}
// The words for each state, in neutral (D3); approved is done, so it is leaf with its check. These words stay apart from
// the testimony states (V19): an issue is "Marked ready", "Approved by Nate", and comes back with "Nate asked for changes".
const STATE = { draft: ['Not public yet', 'eye-off'], todo: ['No steps done yet', 'circle-dashed'], started: ['In progress', 'circle-dot'],
  ready: ['Marked ready', 'clock'], sent_back: ['Changes asked', 'undo-2'], approved: ['Approved', 'circle-check'] };
const stateWords = i => { const k = stateOf(i), by = advocate(i.prep_by);
  return k === 'approved' ? `Approved by ${by ? first(by) : 'an admin'}` : k === 'sent_back' ? `${by ? first(by) : 'An admin'} asked for changes` : STATE[k][0]; };
export const stateChip = i => { const k = stateOf(i); return statusTile({ tone: k === 'approved' ? 'done' : 'neutral', icon: STATE[k][1], words: stateWords(i) }); };

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

// My issues and the ones I help on.
const mine = () => live().filter(i => S.me && i.owner_id === S.me.id && !isDraft(i));
const helping = () => { const ids = new Set((S.issueHelpers || []).filter(h => h.advocate_id === S.me?.id).map(h => h.issue_id)); return live().filter(i => ids.has(i.id) && i.owner_id !== S.me?.id && !isDraft(i)); };
const myDrafts = () => live().filter(i => isDraft(i) && (i.owner_id === S.me?.id || i.created_by === S.me?.id));
// W17: an admin's own issues are approved straight from their card, so they are not "waiting for you".
const waitingForAdmin = () => live().filter(i => stateOf(i) === 'ready' && !(SELF_APPROVE() && i.owner_id === S.me?.id));
// What waits for an admin on the Prep board: issues marked ready, and new issues waiting to go public. All issues shows its
// All issues · Prep board switch in session only while something waits (issues.js).
export const boardWaits = () => isAdmin() ? waitingForAdmin().length + live().filter(isDraft).length : 0;
const isDone = i => ['ready', 'approved'].includes(stateOf(i));
const ORDER = { sent_back: 0, started: 1, todo: 2, ready: 3, approved: 4, draft: 5 };
const ordered = l => l.slice().sort((a, b) => ORDER[stateOf(a)] - ORDER[stateOf(b)] || byName(a, b));
// R-316 W16: an issue opened from a prep list comes back to it, and says so (issues.js reads ?from=prep and ?from=board).
export const issueHref = (i, from = '') => `#/issue/${encodeURIComponent(i.id)}${from ? `?from=${from}` : ''}`;
// Between sessions My issues is the prep list (myIssuesPrep); otherwise it is a view of All issues.
export const prepListHref = () => myIssuesPrep() ? '#/my-issues' : '#/my-issues/all?view=mine';
export const BOARD_HREF = '#/my-issues/all?view=prep';
// The walk-through (W16): after Mark ready, your next unfinished issue; after Approve, the next one waiting; a helper's
// next is the next issue they help on whose steps are not all done (X26: it looped back to a finished one).
const nextToDo = i => ordered(mine().filter(x => x.id !== i.id && !isDone(x)))[0] || null;
const nextHelp = i => ordered(helping().filter(x => x.id !== i.id && !isDone(x) && !partDone(x)))[0] || null;
function nextWaiting(i) {
  const l = waitingForAdmin().sort(byName), at = l.findIndex(x => x.id === i.id);
  return (at < 0 ? l : [...l.slice(at + 1), ...l.slice(0, at)]).find(x => x.id !== i.id) || null;
}
const selfApproves = i => SELF_APPROVE() && isAdmin() && !!S.me && i.owner_id === S.me.id && stateOf(i) !== 'ready';
const nextAfterApprove = i => selfApproves(i) ? nextToDo(i) : nextWaiting(i);
const walkFrom = () => ['prep', 'board'].includes(S.route?.q?.from) ? S.route.q.from : 'prep';

// Each owner's progress, least done first: "Kevin 4/10" (ready or approved, of their issues).
export function ownerProgress() {
  const per = new Map();
  for (const i of live()) { if (isDraft(i) || !i.owner_id) continue; const e = per.get(i.owner_id) || { id: i.owner_id, total: 0, done: 0 }; e.total++; if (isDone(i)) e.done++; per.set(i.owner_id, e); }
  return [...per.values()].sort((a, b) => a.done / a.total - b.done / b.total || b.total - a.total || first(advocate(a.id)).localeCompare(first(advocate(b.id))));
}

// ---- W4: the prep as one task on a person's Today (today.js todayItems), practice copy only for now ----
// Their own issues not yet ready; someone who owns none gets the ones they help on, until their part of each is done (the
// six steps: only the owner marks it ready, X26). It stays after the due day, "Still to finish", until each is done.
export function prepTaskOf(id) {
  if (!PREP_TODAY() || !SESSION_OVER || !id || !(S.issues || []).length) return null;
  const own = live().filter(i => i.owner_id === id && !isDraft(i)), left = ordered(own.filter(i => !isDone(i)));
  if (left.length) return { own: true, total: own.length, ready: own.length - left.length, back: left.filter(i => stateOf(i) === 'sent_back'), next: left[0] };
  const hs = new Set((S.issueHelpers || []).filter(h => h.advocate_id === id).map(h => h.issue_id));
  const help = live().filter(i => hs.has(i.id) && i.owner_id !== id && !isDraft(i)), hl = ordered(help.filter(i => !isDone(i) && !partDone(i)));
  if (!hl.length) return null;
  return { own: false, total: help.length, ready: help.length - hl.length, back: [], next: hl[0], owners: [...new Set(hl.map(i => i.owner_id))].map(advocate).filter(Boolean) };
}
// W4: an admin's one line on Today, from a week before the due day until every issue is approved.
function adminPrepLine() {
  if (!isAdmin()) return '';
  const ok = live().filter(i => !isDraft(i)), n = ok.filter(i => stateOf(i) === 'approved').length, t = Date.now();
  if (!ok.length || n === ok.length || t < dueEnd() - 7 * 864e5) return '';
  const behind = ownerProgress().filter(o => o.done < o.total && o.id !== S.me?.id), shown = behind.slice(0, 3), wait = waitingForAdmin().length;
  const names = shown.map(o => `<a href="${BOARD_HREF}&who=${encodeURIComponent(o.id)}">${esc(first(advocate(o.id)))} ${o.done}/${o.total}</a>`).join(', ');
  return lineHTML('clipboard-check', `<b>Team issues for 2027: ${n} of ${ok.length} approved</b>, ${t > dueEnd() ? `still to finish (they were due ${esc(dueText())})` : `due ${esc(dueWord())}`}.${shown.length ? ` Behind: ${names}${behind.length > 3 ? ` and ${behind.length - 3} more` : ''}.` : ''}`,
    btn(wait ? `Review ${wait} waiting` : 'Open the Prep board', { kind: 'secondary', sm: true, href: `${BOARD_HREF}${wait ? '&f=wait' : ''}` }));
}
// One quiet line with an icon and at most one button (never a coloured box: D3, X33).
const lineHTML = (ic, html, action = '') => `<p class="i6-line">${icon(ic)}<span>${html}</span>${action}</p>`;

// ---- the line on Today: only when there is something for this person (today.js oneNotice) ----
export function todayPrepNotice() {
  if (!S.me || !(S.issues || []).length) return '';
  const line = PREP_TODAY() && SESSION_OVER ? adminPrepLine() : ''; if (line) return line;
  const wait = isAdmin() ? waitingForAdmin().length + live().filter(isDraft).length : 0;
  if (wait) return lineHTML('clipboard-check', `<b>${plural(wait, 'issue')} waiting for you.</b> Approve ${wait === 1 ? 'it' : 'them'} or ask for changes.`, btn('Review', { kind: 'secondary', sm: true, href: `${BOARD_HREF}&f=wait` }));
  // W4 (practice copy): an owner's and a helper's prep is a task in Today's list instead (prepTaskOf).
  if (PREP_TODAY() && SESSION_OVER) return '';
  const own = mine(), left = own.filter(i => !isDone(i));
  if (!left.length) return '';
  const backs = ordered(own.filter(i => stateOf(i) === 'sent_back'));
  // After the due day the line is for what came back, not a standing reminder (R-118: it had no end date).
  if (!backs.length && Date.now() > dueDay().getTime() + 864e5) return '';
  const tally = `${own.length - left.length} of ${own.length} ready, due ${esc(dueText())}.`;
  if (backs.length) { const b0 = backs[0];
    return lineHTML('undo-2', `<b>${esc(first(advocate(b0.prep_by)))} asked for changes to ${esc(b0.name)}:</b> “${esc(String(b0.prep_note || '').replace(/\s+/g, ' ').trim())}”${backs.length > 1 ? ` (and ${backs.length - 1} more)` : ''}. Your issues for 2027: ${tally}`, btn('Open it', { kind: 'secondary', sm: true, href: issueHref(b0, 'prep') })); }
  return lineHTML('clipboard-list', `<b>Your issues for 2027:</b> ${tally}`, btn('Open the list', { kind: 'secondary', sm: true, href: prepListHref() }));
}
// The ways in, kept for callers: your list, and for admins the board (All issues now shows the board as a view, F165).
export function indexLinks({ mineOnly = false } = {}) {
  const own = mine(), help = helping();
  const a = own.length || help.length ? `<a class="i6-link" href="${prepListHref()}">${icon('clipboard-list')}<span>Your issues for 2027${own.length ? `: ${own.filter(isDone).length} of ${own.length} ready` : ''}</span></a>` : '';
  const ok = live().filter(i => !isDraft(i)), n = ok.filter(i => stateOf(i) === 'approved').length;
  const b = isAdmin() && !mineOnly ? `<a class="i6-link" href="${BOARD_HREF}">${icon('clipboard-check')}<span>Prep board: ${n} of ${ok.length} approved</span></a>` : '';
  return a || b ? `<div class="i6-links">${a}${b}</div>` : '';
}
export function prepMenu({ mine: withMine = true } = {}) {
  const own = mine(), help = helping(), ok = live().filter(i => !isDraft(i)), n = ok.filter(i => stateOf(i) === 'approved').length;
  return [
    withMine && (own.length || help.length) ? { label: 'Your issues for 2027', icon: 'clipboard-list', sub: own.length ? `${own.filter(isDone).length} of ${own.length} ready · due ${dueText()}` : `The ones you help on · due ${dueText()}`, run: () => S.go(prepListHref()) } : null,
    isAdmin() ? { label: 'Prep board', icon: 'clipboard-check', sub: `${n} of ${ok.length} approved`, run: () => S.go(BOARD_HREF) } : null,
  ].filter(Boolean);
}

// ---- a sheet for one field: name and description, and the between-sessions text (Edit on the card) ----
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
const pointsErr = v => { const p = pointsIn(v); return p.length > 5 ? 'Five points at most: take one out to save.' : p.some(x => x.length > 200) ? 'Keep each point under 200 characters to save.' : ''; };

// The sheets behind Edit and Change (and v5's callers): the same fields and checks as before.
export function openStep(i, k) {
  if (k === 'wording') return fieldSheet({ title: 'Name and description', help: 'The public follows the issue by this name. Change anything that no longer fits, or say it looks right.',
    fields: [{ k: 'name', label: 'Name', value: i.name, max: 60, help: 'A policy people recognize, in everyday words.',
        check: v => { const nm = v.trim().replace(/\s+/g, ' '), clash = live().find(x => x.id !== i.id && plain(x.name) === plain(nm)); return nm.length < 2 ? 'Give the issue a name.' : clash ? `There is already an issue called “${clash.name}”.` : ''; } },
      { k: 'description', label: 'Description', value: i.description, rows: 3, max: 240, help: 'One sentence on what would change. The public sees it.' }],
    saveLabel: 'Save', unchangedLabel: 'Looks right',
    onSave: async (v, changed) => { await DB.updateIssue(i.id, { ...(changed ? { name: v.name.trim().replace(/\s+/g, ' '), description: v.description.trim() || null } : {}), ...(isDraft(i) ? {} : { wording_checked_at: now() }) });
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
  if (k === 'top') return pickerSheet({ title: 'Top issue for 2027?', value: i.top_pick || '', help: topHelp(),
    options: [['yes', 'Yes, a top issue', 'star', 'Put it forward to be confirmed'], ['no', 'No', 'minus', 'People can still choose to follow it']], onPick: v => setTop(i, v) });
  if (k === 'plan') return pickerSheet({ title: 'In 2027, this issue should…', value: i.proposal || '', help: `Nothing changes until ${esc(adminWord())} approve${adminWord() === 'you' ? '' : 's'} it.`,
    options: [['keep', 'Stay as it is', 'check', 'With the wording you checked'], ['merge', 'Merge into another issue', 'arrow-right', 'Its bills and followers move over'], ['retire', 'Retire', 'archive', 'No longer an issue for HIPHI; its followers stop getting its bills']],
    onPick: async v => { if (v === 'merge') { await afterClose(); return mergePick(i); } return setPlan(i, v); } });
}
// R-288 (Nate 10/15): the owner puts the issue forward and an admin confirms it, which turns on the silent pre-tick
// (issues.recommended, 063). The owner's answer alone changes nothing the public sees.
const topHelp = () => `A top issue is one HIPHI leads with. Once ${esc(adminWord())} confirm${adminWord() === 'you' ? '' : 's'} it, first-time visitors find it already ticked; nothing on the public page says so.`;
async function setTop(i, v, after = () => hooks.render()) {
  const was = i.top_pick || null;
  try { await DB.updateIssue(i.id, { top_pick: v }); after(); toast(v === 'yes' ? `Put forward as a top issue. ${Cap(adminWord())} confirm${adminWord() === 'you' ? '' : 's'} it on the Prep board.` : 'Saved: not a top issue.', { ok: true, undo: async () => { await DB.updateIssue(i.id, { top_pick: was }); hooks.render(); } }); }
  catch (e) { toast(e, { err: true }); }
}
async function setPlan(i, v, after = () => hooks.render()) {
  const was = { proposal: i.proposal || null, proposal_into: i.proposal_into || null };
  try { await DB.updateIssue(i.id, { proposal: v, proposal_into: null }); after(); toast(v === 'retire' ? 'Marked to retire, once approved.' : 'Marked to keep.', { ok: true, undo: async () => { await DB.updateIssue(i.id, was); hooks.render(); } }); }
  catch (e) { toast(e, { err: true }); }
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
    onPick: async id => { try { await DB.addIssueHelper(i.id, id); hooks.render(); toast(`${first(advocate(id))} is helping. They get a Slack message.`, { ok: true, undo: async () => { await DB.removeIssueHelper(i.id, id); hooks.render(); } }); } catch (e) { toast(e, { err: true }); } } });
}
function helperMenu(i, a) {
  const self = a.id === S.me?.id;
  menuSheet({ title: esc(first(a)), items: [
    { label: self ? 'Stop helping' : 'Remove as helper', icon: 'x', danger: true, disabled: !(self || mayManage(i)), reason: 'Only the owner or an admin can.',
      run: async () => { try { await DB.removeIssueHelper(i.id, a.id); hooks.render(); toast(self ? 'You are no longer helping.' : `${first(a)} is no longer helping.`, { undo: async () => { await DB.addIssueHelper(i.id, a.id); hooks.render(); } }); } catch (e) { toast(e, { err: true }); } } },
  ] });
}

// ---- the card on an issue's page ----
// A new issue's card ("Before it goes public"): its description, goal and points.
const DRAFT_STEPS = [{ ...STEPS[0], label: 'Description', todo: 'One sentence the public sees', done: x => !!(x.description || '').trim(), did: x => x.description }, STEPS[2], STEPS[3]];
function peopleHTML(i) {
  const o = ownerOfIssue(i), hs = helpersOf(i);
  return `<div class="pr6-people">
    <p class="pr6-who"><span class="pr6-wl">Owner</span>${o ? `${avatar(o, 24)}<span>${esc(o.id === S.me?.id ? 'You' : ownerName(o))}</span>` : '<span>Nobody yet</span>'}
      ${mayManage(i) ? btn(o ? 'Change' : 'Choose', { kind: 'text', sm: true, attrs: { 'data-pr': 'owner', 'aria-label': o ? 'Change the owner' : 'Choose the owner', 'aria-haspopup': 'dialog' } }) : ''}</p>
    <p class="pr6-who"><span class="pr6-wl">Helpers</span>${hs.map(a => `<button type="button" class="pr6-helper" data-prh="${esc(a.id)}" aria-haspopup="dialog" aria-label="${esc(`${a.id === S.me?.id ? 'You' : first(a)}: helper. Stop helping or remove`)}">${avatar(a, 24)}<span>${esc(a.id === S.me?.id ? 'You' : first(a))}</span></button>`).join('') || (mayManage(i) ? '' : '<span>None</span>')}
      ${mayManage(i) ? btn('Add', { kind: 'text', sm: true, icon: 'plus', attrs: { 'data-pr': 'helper', 'aria-label': 'Add a helper', 'aria-haspopup': 'dialog' } }) : ''}</p>
  </div>`;
}
// What is typed in a box and not saved yet (a sixth point, a point too long) survives a redraw (B-6, C-9).
const DRAFT = () => S.prDraft ??= {};
// The one open step (the critic: six steps open at once made a card taller than a laptop screen): the one the person chose
// (Open, Change), else the first still to do. Each step done opens the next by itself, so the clicks stay at most 8.
const OPEN1 = () => S.prOpen1 ??= {};
const helperView = i => isHelper(i) && !isAdmin();
const openKey = (i, steps) => { const k = OPEN1()[i.id]; if (k && steps.some(s => s.k === k)) return k;
  // A helper's card opens on their own part first.
  return (helperView(i) && steps.find(s => HELP_PART.includes(s.k) && !s.done(i))?.k) || steps.find(s => !s.done(i))?.k || null; };
// The step after `k` still to do (wrapping), for "Next step"; null when none is left.
const nextOpen = (i, steps, k) => { const at = steps.findIndex(s => s.k === k), l = [...steps.slice(at + 1), ...steps.slice(0, at)]; return l.find(s => !s.done(i))?.k || null; };
// Under a typed step: "Next step" (or "Done"), but "Skip for now", in text style, while the goal is empty or the talking
// points are short of three, so moving on is never mistaken for finishing the step (A-16, B-7; the critic: Next step
// closed it as To do, silently). Moving on that way says what is still needed.
const shortPoints = (k, v) => k === 'points' ? pointsIn(v).length < 3 : k === 'goal' ? !String(v || '').trim() : false;
const stillNeeds = (k, v) => k === 'points' ? `Talking points still need ${3 - pointsIn(v).length} more.` : 'The goal is still empty.';
const nextBtn = (k, v, more) => shortPoints(k, v) ? btn('Skip for now', { kind: 'text', sm: true, attrs: { 'data-prnext': k, 'data-more': more ? '1' : '0' } })
  : btn(more ? 'Next step' : 'Done', { kind: 'secondary', sm: true, iconEnd: 'arrow-right', attrs: { 'data-prnext': k, 'data-more': more ? '1' : '0' } });
// A step's own control, inline; [data-prfocus] takes the focus when it opens.
function openHTML(i, s, { draftCard = false, peek = false } = {}) {
  const k = s.k, dv = DRAFT()[i.id]?.[k], f = peek ? {} : { 'data-prfocus': '1' };
  const say = (txt, empty = 'Nothing written yet') => `<p class="pr6-quote">${txt ? esc(txt) : `<span class="pr6-none">${empty}</span>`}</p>`;
  // The name and description are the page's own heading, right above the card: the step points at them (A-14: said once).
  if (k === 'wording') return draftCard
    ? `<p class="pr6-acts">${btn(i.description ? 'Edit' : 'Write it', { kind: 'secondary', sm: true, icon: 'pencil', attrs: { 'data-prstep': 'wording', ...f, 'aria-haspopup': 'dialog' } })}</p>`
    : `<p class="pr6-acts">${btn('Looks right', { kind: 'secondary', sm: true, icon: 'check', attrs: { 'data-prok': 'wording', ...f } })}${btn('Edit', { kind: 'text', sm: true, attrs: { 'data-prstep': 'wording', 'aria-haspopup': 'dialog', 'aria-label': 'Edit the name and description' } })}</p>`;
  if (k === 'outlook') return `${say(i.outlook)}<p class="pr6-acts">${btn('Looks right', { kind: 'secondary', sm: true, icon: 'check', attrs: { 'data-prok': 'outlook', ...f } })}${btn('Edit', { kind: 'text', sm: true, attrs: { 'data-prstep': 'outlook', 'aria-haspopup': 'dialog', 'aria-label': 'Edit what the public reads between sessions' } })}</p>`;
  if (k === 'goal' || k === 'points') {
    const val = dv ?? (k === 'goal' ? i.goal || '' : pointsOf(i).join('\n')), id = `pr-in-${k}-${esc(i.id)}`;
    // Saving and Saved say that it saves as you type (B-7); "Next step" goes on (or "Done" when nothing is left).
    return `<textarea class="pr6-box" id="${id}" rows="${k === 'goal' ? 3 : 5}" maxlength="${k === 'goal' ? 600 : 1100}" data-prauto="${k}" ${peek ? '' : 'data-prfocus="1"'} aria-labelledby="pr6-l-${k}" aria-describedby="pr6-d-${k} ${id}-said"${k === 'points' ? ' placeholder="One plain sentence per line."' : ''}>${esc(val)}</textarea>
      <div class="pr6-boxfoot"><p class="pr6-said" id="${id}-said" role="status">${k === 'points' ? esc(pointsCount(val)) : ''}</p>${nextBtn(k, val, !!nextOpen(i, draftCard ? DRAFT_STEPS : STEPS, k))}</div>`;
  }
  if (k === 'top') return `<p class="pr6-acts" role="group" aria-labelledby="pr6-l-top">${[['yes', 'Yes, a top issue', 'star'], ['no', 'No', 'minus']].map(([v, l, ic], n) => btn(l, { kind: 'secondary', sm: true, icon: ic, attrs: { 'data-prtopv': v, 'aria-pressed': String(i.top_pick === v), ...(n ? {} : f) } })).join('')}</p>`;
  if (k === 'plan') return `<p class="pr6-acts" role="group" aria-labelledby="pr6-l-plan">${btn('Keep it', { kind: 'secondary', sm: true, icon: 'check', attrs: { 'data-prplan': 'keep', 'aria-pressed': String(i.proposal === 'keep'), ...f } })}${btn('Merge into…', { kind: 'secondary', sm: true, icon: 'arrow-right', attrs: { 'data-prplan': 'merge', 'aria-pressed': String(i.proposal === 'merge'), 'aria-haspopup': 'dialog' } })}${btn('Retire', { kind: 'secondary', sm: true, icon: 'archive', attrs: { 'data-prplan': 'retire', 'aria-pressed': String(i.proposal === 'retire') } })}</p>`;
  return '';
}
// The steps: a number in a sand tile (a check once done; never an empty circle that looks like a box to tick, the critic),
// the name, and one line. One step is open with its control; a step typed in (goal, points) has the next one waiting under
// it, shown the moment the typing is saved, so its first button is the next click. Done ones say what was done, with
// Change; the ones still to do say "To do", with Open. Anyone who does not work the card reads each step's line.
const TYPED = new Set(['goal', 'points']);
function stepsHTML(i, steps, { work = false, draftCard = false } = {}) {
  const cur = work ? openKey(i, steps) : null, peeks = new Map();   // a waiting step -> the typed step that shows it
  for (let t = cur; t && TYPED.has(t) && !steps.find(s => s.k === t).done(i);) { const nx = nextOpen(i, steps, t); if (!nx || nx === cur || peeks.has(nx)) break; peeks.set(nx, t); t = nx; }
  return `<ol class="pr6-steps">${steps.map((s, n) => { const d = s.done(i), open = s.k === cur, peek = peeks.has(s.k);
    // An admin confirms a top issue right on its step (R-316 W16), as on the board's Top issues view.
    const conf = s.k === 'top' && isAdmin() && i.top_pick === 'yes' && !isDraft(i) ? topBtn(i) : '';
    const mine = helperView(i) && HELP_PART.includes(s.k), theirs = helperView(i) && !HELP_PART.includes(s.k), own = ownerOfIssue(i);
    const said = d ? (s.k === 'points' ? plural(pointsOf(i).length, 'point') : clip(s.did(i), 90)) : mine ? 'To do' : theirs ? `${own ? first(own) : 'The owner'}’s step` : work ? 'To do' : todoOf(s);
    const closedBtn = !work ? '' : d ? btn('Change', { kind: 'text', sm: true, attrs: { 'data-prchange': s.k, 'aria-label': `Change: ${s.label}`, ...(['wording', 'outlook'].includes(s.k) ? { 'aria-haspopup': 'dialog' } : {}) } })
      : btn('Open', { kind: 'text', sm: true, attrs: { 'data-propen': s.k, 'aria-label': `Open: ${s.label}` } });
    const closed = `<p class="pr6-sd">${esc(said)}</p>${conf}`, body = `<p class="pr6-sd" id="pr6-d-${s.k}">${esc(todoOf(s))}</p>${openHTML(i, s, { draftCard, peek })}${conf}`;
    return `<li class="pr6-step${d ? ' done' : ''}${open ? ' open' : ''}" data-prk="${s.k}" data-prn="${n + 1}"${peek ? ` data-prpeek="${peeks.get(s.k)}"` : ''}>
      <span class="pr6-mark" aria-hidden="true">${d ? icon('circle-check') : `<span class="pr6-n">${n + 1}</span>`}</span>
      <div class="pr6-sb"><p class="pr6-sl" id="pr6-l-${s.k}">${esc(s.label)}${mine ? ' <span class="pr6-yourpart">Your part</span>' : ''}<span class="sr">${d ? ': done' : ': to do'}</span></p>
        ${open ? body : peek ? `<div class="pr6-closed">${closed}</div><div class="pr6-peekb" hidden>${body}</div>` : closed}</div>
      ${open ? '' : peek ? `<span class="pr6-closed">${closedBtn}</span>` : closedBtn}</li>`; }).join('')}</ol>`;
}
const listWords = l => l.length < 2 ? l.join('') : `${l.slice(0, -1).join(', ')} and ${l[l.length - 1]}`;
const leftWords = n => `${n} step${n === 1 ? '' : 's'} left`;
// The card's foot: one filled button, the step this person takes now (spec 4). Once it acts (the six steps done, or an
// issue waiting for an admin), it is sticky at the window's foot while the card is in view, so "Mark ready and open the
// next" is always in reach (V30); while steps are left it waits at the card's end, under the last step, and says how many.
function footHTML(i) {
  const st = stateOf(i), n = doneN(i), left = STEPS.length - n, owner = isOwner(i);
  const apLabel = nextAfterApprove(i) ? 'Approve and open the next' : 'Approve';
  if (st === 'approved') return '';
  if (st === 'ready') return isAdmin()
    ? { sticky: true, html: `${btn(apLabel, { icon: 'check', attrs: { 'data-pr': 'approve' } })}${btn('Ask for changes', { kind: 'secondary', attrs: { 'data-pr': 'sendback', 'aria-haspopup': 'dialog' } })}${owner ? btn('Not ready yet', { kind: 'text', attrs: { 'data-pr': 'unready' } }) : ''}` }
    : { html: `<span class="pr6-fs">${esc(approves())} it next.</span>${owner ? btn('Not ready yet', { kind: 'text', attrs: { 'data-pr': 'unready' } }) : ''}` };
  // W17: on an issue an admin owns, Approve as soon as the six steps are done; nobody else needs to see it ready.
  if (selfApproves(i)) return { sticky: !left, html: `${btn(apLabel, { icon: 'check', attrs: { 'data-pr': 'approve', ...(left ? { 'aria-disabled': 'true' } : {}) } })}<span class="pr6-fs">${left ? leftWords(left) : 'You own it, so your approval is the last step.'}</span>` };
  if (owner || isAdmin()) return { sticky: !left, html: `${btn(owner && nextToDo(i) ? 'Mark ready and open the next' : 'Mark ready', { icon: 'send', attrs: { 'data-pr': 'ready', ...(left ? { 'aria-disabled': 'true' } : {}) } })}<span class="pr6-fs">${left ? leftWords(left) : `${esc(approves())} it next.`}</span>` };
  const o = ownerOfIssue(i), who = o ? first(o) : 'The owner';
  // A helper's part closes when the six steps are done (spec 6): it says so and opens their next issue, never one finished.
  if (isHelper(i)) { const nx = nextHelp(i);
    return partDone(i) ? { sticky: !!nx, html: `<span class="pr6-fs pr6-yours">${icon('circle-check')}<span>Your part is done. ${esc(who)} marks it ready.</span></span>${nx ? btn('Open the next', { iconEnd: 'arrow-right', href: issueHref(nx, walkFrom()) }) : ''}` }
      : { html: `<span class="pr6-fs">Your part: ${esc(partWords())}, ${partSteps().filter(s => !s.done(i)).length} still to do · ${esc(who)} does the rest and marks it ready.</span>` }; }
  return { html: `<span class="pr6-fs">${esc(who)} marks it ready.</span>` };
}
// `outlook` (v3): in session the issue's page puts what the public reads between sessions in here, folded with the rest
// of the 2027 work, instead of under the issue's name.
// Between sessions, while the card leads and the outlook is a step to check, the card holds the outlook (the page's header
// leaves it out, A-14).
export const prepHoldsOutlook = i => !!i && !isDraft(i) && !i.archived_at && stateOf(i) !== 'approved' && canWork(i);
export function prepCardHTML(i, { outlook = '' } = {}) {
  if (!i || i.archived_at) return '';
  if (isDraft(i)) {
    const m = missing(i), who = adminWord();
    const steps = DRAFT_STEPS;
    return `<section class="pr6-card pr6-draft" aria-labelledby="pr-h">
      <div class="pr6-head"><h2 id="pr-h">Before it goes public</h2><p class="pr6-sub">${statusTile({ tone: 'neutral', icon: 'eye-off', words: 'Not public yet' })}</p></div>
      <p class="pr6-lede">${m.length ? `It still needs ${esc(listWords(m.map(x => x[1])))}.` : `It has everything. ${isAdmin() ? 'Publish it when you are happy with it.' : `${esc(Cap(who))} publish${who === 'you' ? '' : 'es'} it.`}`}</p>
      ${peopleHTML(i)}
      ${stepsHTML(i, steps, { work: canWork(i) || isOwner(i) || i.created_by === S.me?.id, draftCard: true })}
      ${isAdmin() ? `<div class="pr6-foot sticky">${btn('Publish', { icon: 'globe', attrs: { 'data-pr': 'publish', ...(m.length ? { 'aria-disabled': 'true' } : {}) } })}${m.length ? `<span class="pr6-fs">Needs ${esc(listWords(m.map(x => x[1])))} first.</span>` : ''}</div>` : ''}
    </section>`;
  }
  const st = stateOf(i), by = advocate(i.prep_by), work = canWork(i) && ['todo', 'started', 'sent_back'].includes(st);
  // During session the folded "Getting ready for 2027 · No steps done yet" card is left out unless someone has started
  // it (R-336 walk 3, item 7): a November job sat on the page of an issue being fought for now. It comes back when the
  // session ends (SESSION_OVER), when the prep is the work again.
  if (!SESSION_OVER && st === 'todo') return '';
  const note = st === 'sent_back' ? `<p class="pr6-note">${icon('undo-2')}<span><b>${esc(by ? first(by) : 'An admin')} asked for changes:</b> ${esc(i.prep_note || '')}</span></p>`
    : st === 'approved' ? `<p class="pr6-note">${icon('circle-check')}<span><b>Approved${by ? ` by ${esc(first(by))}` : ''}.</b>${i.prep_note ? ` ${esc(i.prep_note)}` : ''}</span>${isAdmin() ? btn('Undo', { kind: 'text', sm: true, attrs: { 'data-pr': 'undo', 'aria-label': 'Undo the approval' } }) : ''}</p>` : '';
  const foot = footHTML(i);
  const inner = `${outlook ? `<div class="pr6-outlook">${outlook}</div>` : ''}
    ${note}${peopleHTML(i)}${stepsHTML(i, STEPS, { work: work || (canWork(i) && st !== 'approved') })}
    ${foot ? `<div class="pr6-foot${foot.sticky ? ' sticky' : ''}">${foot.html}</div>` : ''}`;
  const sub = `<p class="pr6-sub">${stateChip(i)}<span>${esc(st === 'approved' ? '' : dueSay())}</span><a href="#/help/prep">How to get an issue ready</a></p>`;
  // Session work first (R-118): once the issue is approved, or the session is under way, the card folds to one line and
  // the issue's bills come first on its page (a fold holds what is done, rule 3).
  if (st === 'approved' || legislativeDay()) return `<details class="pr6-card pr6-fold"><summary><span class="pr6-foldt">${icon('clipboard-check')}<b>Getting ready for 2027</b>${stateChip(i)}</span>${icon('chevron-down', { cls: 'i6-chev' })}</summary>${inner}</details>`;
  return `<section class="pr6-card" aria-labelledby="pr-h">
    <div class="pr6-head"><h2 id="pr-h">Getting ready for 2027</h2>${sub}</div>
    ${inner}
  </section>`;
}

// ---- the card's wiring ----
// Saves as you type (B-7): a pause of a second, leaving the box, or any other step's button saves what is in the box first.
const PENDING = new Set();
async function flush() { for (const f of [...PENDING]) await f(); }
// After a step: redraw where the page was, and put the focus on the next step still to do (or the foot's button).
function after(focusK = null) {
  const y = window.scrollY; hooks.render();
  if (Math.abs(window.scrollY - y) > 1) window.scrollTo(0, y);
  const card = document.querySelector('.pr6-card');
  const el = (focusK && card?.querySelector(`[data-prk="${focusK}"] [data-prfocus], [data-prk="${focusK}"] [data-prchange]`)) || card?.querySelector('.pr6-step.open [data-prfocus]') || card?.querySelector('.pr6-foot .btn');
  el?.focus({ preventScroll: true });
}
// Paint the progress in place (a step's tick, the foot's count and button) without a redraw, so typing is never interrupted.
function paintProgress(i, card) {
  card.querySelectorAll('.pr6-step').forEach(li => { const s = STEPS.find(x => x.k === li.dataset.prk); if (!s) return; const d = s.done(i);
    li.classList.toggle('done', d); const m = li.querySelector('.pr6-mark'); if (m) m.innerHTML = d ? icon('circle-check') : `<span class="pr6-n">${esc(li.dataset.prn || '')}</span>`;
    const sr = li.querySelector('.pr6-sl .sr'); if (sr) sr.textContent = d ? ': done' : ': to do'; });
  STEPS.filter(s => s.done(i)).forEach(s => revealAfter(card, s.k));
  const f = footHTML(i), foot = card.querySelector('.pr6-foot');
  if (foot && f) { const focused = foot.contains(document.activeElement); foot.innerHTML = f.html; foot.classList.toggle('sticky', !!f.sticky); wireFoot(i, card); if (focused) foot.querySelector('.btn')?.focus({ preventScroll: true }); }
}
// The step waiting under a typed one shows as soon as what is typed would do the step (and again once it is saved): its
// first button is the next click, with no "Next step" in between.
function revealAfter(card, k) {
  card.querySelectorAll(`[data-prpeek="${k}"]`).forEach(li => { if (li.classList.contains('open')) return;
    li.querySelectorAll('.pr6-closed').forEach(e => { e.hidden = true; }); const b = li.querySelector('.pr6-peekb'); if (b) b.hidden = false; li.classList.add('open'); });
}
const enough = (k, v) => k === 'goal' ? !!v.trim() : pointsIn(v).length >= 3 && !pointsErr(v);
function wireAuto(i, card) {
  PENDING.clear();
  card.querySelectorAll('[data-prauto]').forEach(ta => {
    const k = ta.dataset.prauto, said = card.querySelector(`#${CSS.escape(ta.id)}-said`);
    const saved = () => k === 'goal' ? (i.goal || '') : pointsOf(i).join('\n');
    let t = null;
    const save = async () => {
      clearTimeout(t); t = null; PENDING.delete(save);
      const v = ta.value; if (v.trim() === saved().trim()) { delete DRAFT()[i.id]?.[k]; return; }
      const err = k === 'points' ? pointsErr(v) : '';
      if (err) { ta.setAttribute('aria-invalid', 'true'); said.textContent = err; return; }
      ta.removeAttribute('aria-invalid'); said.textContent = 'Saving…';
      try {
        await DB.updateIssue(i.id, k === 'goal' ? { goal: v.trim() || null } : { talking_points: pointsIn(v), talking_points_edited_at: now() });
        delete DRAFT()[i.id]?.[k];
        if (ta.isConnected) { said.textContent = k === 'points' ? `${pointsCount(v)} · saved` : 'Saved'; paintProgress(i, card); }
      } catch (e) { if (ta.isConnected) said.textContent = `Not saved: ${friendly(e)}`; }
    };
    ta.addEventListener('input', () => {
      (DRAFT()[i.id] ??= {})[k] = ta.value; ta.removeAttribute('aria-invalid'); if (enough(k, ta.value)) revealAfter(card, k);
      said.textContent = k === 'points' ? pointsCount(ta.value) : '';
      // The button under the box turns from Skip for now to Next step as the goal or the third point is typed, and back.
      const nb = ta.parentElement?.querySelector(`.pr6-boxfoot [data-prnext="${k}"]`);
      if (nb) { const short = shortPoints(k, ta.value); if (short !== nb.classList.contains('text')) {
        nb.classList.toggle('text', short); nb.classList.toggle('secondary', !short); nb.querySelector('span').textContent = short ? 'Skip for now' : nb.dataset.more === '0' ? 'Done' : 'Next step';
        if (short) nb.querySelector('svg, .ic')?.remove(); else if (!nb.querySelector('svg, .ic')) nb.insertAdjacentHTML('beforeend', icon('arrow-right')); } }
      clearTimeout(t); t = setTimeout(save, 1000); PENDING.add(save);
    });
    ta.addEventListener('blur', () => { if (PENDING.has(save)) save(); });
  });
}
function wireFoot(i, card) {
  const foot = card.querySelector('.pr6-foot'); if (!foot) return;
  const on = (k, fn) => foot.querySelector(`[data-pr="${k}"]`)?.addEventListener('click', fn);
  // Mark ready with steps left: it says which, and opens the first of them.
  const stillToDo = () => { const left = STEPS.filter(s => !s.done(i)); toast(`Still to do: ${left.map(s => s.label.toLowerCase()).join(', ')}.`);
    if (!left[0]) return; OPEN1()[i.id] = left[0].k; after(left[0].k); document.querySelector(`.pr6-card [data-prk="${left[0].k}"]`)?.scrollIntoView({ block: 'center' }); };
  on('ready', async e => {
    await flush();
    if (doneN(i) < STEPS.length) return stillToDo();
    void e;
    const nx = isOwner(i) ? nextToDo(i) : null;
    try { await DB.updateIssue(i.id, { prep_state: 'ready' }); if (nx) S.go(issueHref(nx, walkFrom())); else after();
      toast(`Marked ready. ${approves()} it next.${nx ? ` Next: ${nx.name}.` : ''}`, { ok: true, undo: async () => { await DB.updateIssue(i.id, { prep_state: 'todo' }); hooks.render(); } }); }
    catch (err) { toast(err, { err: true }); }
  });
  on('unready', async () => { try { await DB.updateIssue(i.id, { prep_state: 'todo' }); after(); toast('Taken back. Mark it ready again when it is.'); } catch (err) { toast(err, { err: true }); } });
  on('approve', async () => { await flush(); if (selfApproves(i) && doneN(i) < STEPS.length) return stillToDo(); approve(i, nextAfterApprove(i)); });
  on('sendback', () => sendBack(i));
  on('publish', async () => {
    await flush();
    const m = missing(i);
    if (m.length) { toast(`It needs ${listWords(m.map(x => x[1]))} first.`); const k = m[0][0]; if (k === 'owner') changeOwner(i); else if (k === 'bill') document.getElementById('is-bq')?.focus(); else { OPEN1()[i.id] = k; after(k); } return; }
    const ok = await confirmSheet({ title: `Publish ${esc(i.name)}?`, ok: 'Publish', text: 'The public can find and follow it from now on. People who follow its whole category get it too.' });
    if (!ok) return;
    // Publishing is the admin's approval of the whole issue, so its prep steps count as done too.
    const at = now();
    try { await DB.updateIssue(i.id, { published_at: at, prep_state: 'approved', wording_checked_at: i.wording_checked_at || at, outlook_checked_at: i.outlook_checked_at || at, proposal: 'keep', proposal_into: null }); hooks.render(); toast(`${i.name} is public.`, { ok: true }); }
    catch (err) { toast(err, { err: true }); }
  });
}
export function wirePrepCard(i, root) {
  const card = root.querySelector('.pr6-card'); if (!card || !i) return;
  const steps = isDraft(i) ? DRAFT_STEPS : STEPS;
  wireAuto(i, card);
  // Edit (a sheet) and Change: the public wording and the between-sessions text open their sheet; the rest open in place.
  card.querySelectorAll('[data-prstep]').forEach(el => el.onclick = async () => { await flush(); openStep(i, el.dataset.prstep); });
  card.querySelectorAll('[data-prchange]').forEach(el => el.onclick = async () => { await flush(); const k = el.dataset.prchange;
    if (['wording', 'outlook'].includes(k)) return openStep(i, k);
    OPEN1()[i.id] = k; after(k); });
  // Open: a step still to do, out of order. Next step / Done: on to the next step still to do after this one.
  card.querySelectorAll('[data-propen]').forEach(el => el.onclick = async () => { await flush(); OPEN1()[i.id] = el.dataset.propen; after(el.dataset.propen); });
  card.querySelectorAll('[data-prnext]').forEach(el => el.onclick = async () => { const k = el.dataset.prnext, ta = card.querySelector(`[data-prauto="${k}"]`);
    const short = ta && shortPoints(k, ta.value) ? stillNeeds(k, ta.value) : '';
    await flush(); const nx = nextOpen(i, steps, k);
    if (nx) OPEN1()[i.id] = nx; else delete OPEN1()[i.id]; after(nx);
    if (short) toast(`${short} The step stays To do.`); });
  // "Looks right": the wording or the outlook checked as it is, one tap; the next step opens by itself.
  card.querySelectorAll('[data-prok]').forEach(el => el.onclick = async () => {
    await flush(); const k = el.dataset.prok, f = k === 'wording' ? 'wording_checked_at' : 'outlook_checked_at';
    if (OPEN1()[i.id] === k) delete OPEN1()[i.id];
    try { await DB.updateIssue(i.id, { [f]: now() }); after(); toast('Marked as checked.', { ok: true, undo: async () => { await DB.updateIssue(i.id, { [f]: null }); hooks.render(); } }); }
    catch (e) { toast(e, { err: true }); }
  });
  card.querySelectorAll('[data-prtopv]').forEach(el => el.onclick = async () => { await flush(); if (OPEN1()[i.id] === 'top') delete OPEN1()[i.id]; setTop(i, el.dataset.prtopv, () => after()); });
  card.querySelectorAll('[data-prplan]').forEach(el => el.onclick = async () => { await flush(); if (OPEN1()[i.id] === 'plan') delete OPEN1()[i.id];
    const v = el.dataset.prplan; if (v === 'merge') return mergePick(i); setPlan(i, v, () => after()); });
  card.querySelectorAll('[data-prh]').forEach(el => el.onclick = () => { const a = advocate(el.dataset.prh); if (a) helperMenu(i, a); });
  card.querySelector('[data-pr="owner"]')?.addEventListener('click', () => changeOwner(i));
  card.querySelector('[data-pr="helper"]')?.addEventListener('click', () => addHelper(i));
  card.querySelectorAll('[data-prtop]').forEach(el => el.onclick = () => toggleTop(i));
  card.querySelector('[data-pr="undo"]')?.addEventListener('click', async () => { try { await DB.reviewIssue(i.id, 'undo'); hooks.render(); toast('Approval undone. It is marked ready again.'); } catch (err) { toast(err, { err: true }); } });
  wireFoot(i, card);
}
// Confirming a top issue turns on the silent pre-tick (issues.recommended, 063); the card and the board share it.
async function toggleTop(i) {
  const was = !!i.recommended;
  try { await DB.updateIssue(i.id, { recommended: !was }); hooks.render();
    toast(was ? `${i.name}: no longer pre-ticked.` : `${i.name}: confirmed.`, { ok: !was, undo: async () => { await DB.updateIssue(i.id, { recommended: was }); hooks.render(); } }); }
  catch (e) { toast(e, { err: true }); }
}
// `next` (W16): the issue to open after this one, so approving walks the list.
async function approve(i, next = null) {
  const into = i.proposal === 'merge' ? S.issues.find(x => x.id === i.proposal_into) : null;
  if (i.proposal === 'merge' || i.proposal === 'retire') {
    const ok = await confirmSheet({ title: i.proposal === 'merge' ? `Approve and merge into ${esc(into?.name || 'the other issue')}?` : `Approve and retire ${esc(i.name)}?`, ok: i.proposal === 'merge' ? 'Approve and merge' : 'Approve and retire', danger: true,
      text: i.proposal === 'merge' ? `${esc(i.name)}’s bills and followers move to ${esc(into?.name || 'it')}, and ${esc(i.name)} is archived. A merge cannot be undone from here.` : 'The public stops seeing it, and its followers stop getting its bills. You can restore it from All issues, under Archived.' });
    if (!ok) return;
  }
  try {
    await DB.reviewIssue(i.id, 'approve'); if (next) S.go(issueHref(next, walkFrom())); else after();
    const canUndo = !['merge', 'retire'].includes(i.proposal);
    toast(i.owner_id && i.owner_id !== S.me?.id ? `Approved. ${first(ownerOfIssue(i))} gets a Slack message.` : 'Approved.', { ok: true, ...(canUndo ? { undo: async () => { await DB.reviewIssue(i.id, 'undo'); hooks.render(); } } : {}) });
  } catch (e) { toast(e, { err: true }); }
}
function sendBack(i) {
  fieldSheet({ title: `Ask for changes to ${esc(i.name)}`, saveLabel: 'Ask for changes',
    fields: [{ k: 'note', label: 'What needs changing', rows: 3, max: 600, help: `${esc(first(ownerOfIssue(i)))} gets it in Slack and sees it on the issue.`, check: v => v.trim() ? '' : 'Say what needs changing, so the owner knows.' }],
    onSave: async v => { await DB.reviewIssue(i.id, 'send_back', v.note.trim()); toast('Changes asked. The owner gets a Slack message.', { ok: true }); } });
}

// ---- the team's step (R-288): the lists supporters follow and pass on, planned before session ----
// Lists hold bills, and the 2027 bills arrive in January, so the step now is to make each list as a draft. One line here
// (v6: v5's card was a fourth box on the page).
const listsLine = () => { const ls = S.lists || [], on = ls.filter(l => l.is_published).length;
  return lineHTML('list-checks', `For the whole team: plan the session’s lists to share. ${esc(`${plural(on, 'live list')}, ${plural(ls.length - on, 'draft')}`)}.`, `<a class="i6-inline" href="#/outreach/lists">Open Lists</a>`); };

// ---- the prep list: My issues between sessions (W16, F161) ----
// One row per issue (steps.js itemRow): its name, then one line in words (how many steps, or where it is). Ready and
// approved ones wait in one fold at the end (a fold holds what is done, rule 3), so the list shrinks as the work is done.
function prepLine(i, { helper = false } = {}) {
  const k = stateOf(i), n = doneN(i), by = advocate(i.prep_by), o = ownerOfIssue(i);
  if (k === 'draft') { const m = missing(i); return { ic: 'eye-off', t: m.length ? `Not public yet · needs ${listWords(m.map(x => x[1]))}` : 'Not public yet · ready to publish' }; }
  if (k === 'approved') return { ic: 'circle-check', tone: 'done', t: `Approved by ${by ? first(by) : 'an admin'}` };
  if (k === 'ready') return { ic: 'clock', t: `Marked ready · ${approves()} it next` };
  if (k === 'sent_back') return { ic: 'undo-2', t: `${by ? first(by) : 'An admin'} asked for changes${i.prep_note ? `: “${String(i.prep_note).replace(/\s+/g, ' ').trim()}”` : ''}` };
  if (helper) return partDone(i) ? { ic: 'circle-check', t: `Your part is done · ${o ? first(o) : 'the owner'} marks it ready` } : { ic: '', t: `${o ? `${first(o)}’s issue` : 'No owner'} · ${n} of ${STEPS.length} steps done` };
  return { ic: '', t: `${n} of ${STEPS.length} steps done${pastDue() ? ' · still to finish' : ''}` };
}
function prepRow(i, o = {}) {
  const l = prepLine(i, o);
  return itemRow({ key: i.id, name: i.name, line: nw(esc(l.t)), icon: l.ic, tone: l.tone || '', href: issueHref(i, 'prep'), cls: 'i6-row' });
}
const box = rows => `<div class="v6-list i6-list" role="list">${rows}</div>`;
const doneFold = (id, l, rowFn) => l.length ? `<details class="i6-fold" data-fold="${id}"><summary>${icon('chevron-down', { cls: 'i6-chev' })}<span>Marked ready and approved (${l.length})</span></summary>${box(l.map(rowFn).join(''))}</details>` : '';
function mineRender({ asMyIssues = false } = {}) {
  const own = ordered(mine()), help = ordered(helping()), drafts = myDrafts();
  const ready = own.filter(isDone).length, left = own.filter(i => !isDone(i));
  const helpLeft = help.filter(i => !isDone(i) && !partDone(i));
  const next = left[0] || helpLeft[0] || null;
  // One sentence of where you are, said once (A-14), in words that never alarm after the date (spec 6).
  const lede = own.length ? (left.length ? `${ready} of ${own.length} ready. ${pastDue() ? `Still to finish: ${left.length} (they were due ${dueText()})` : `Due ${dueText()}`}.` : `All ${own.length} ready or approved.`)
    : help.length ? `You help on ${plural(help.length, 'issue')}. Each owner marks theirs ready.` : 'Getting the issues ready for 2027.';
  const head = headHTML(asMyIssues ? 'mine' : 'all');
  const ok = live().filter(i => !isDraft(i)), nApp = ok.filter(i => stateOf(i) === 'approved').length;
  return `<div class="le-page i6-page pr6-page">
    ${head}
    <section class="pr6-top" aria-labelledby="pr6-th"><h2 class="i6-h" id="pr6-th">Your issues for 2027</h2>
      <p class="pr6-lede">${esc(lede)}</p>
      ${next ? `<p class="pr6-next">${btn(`${STEPS.some(x => x.done(next)) ? 'Continue' : left.length === own.length && !ready && own.length ? 'Start' : 'Next'}: ${esc(next.name)}`, { iconEnd: 'arrow-right', href: issueHref(next, 'prep') })}</p>` : ''}
      ${isAdmin() ? lineHTML('clipboard-check', esc(`Team: ${nApp} of ${ok.length} approved.`), `<a class="i6-inline" href="${BOARD_HREF}">Open the Prep board</a>`) : ''}
    </section>
    ${!own.length && !help.length && !drafts.length ? `<div class="le-empty">${empty({ title: 'No issues are yours yet', text: `${esc(Cap(adminWord()))} give${adminWord() === 'you' ? '' : 's'} out the issues. Any you own or help on show here.`, action: btn('See all issues', { kind: 'secondary', href: '#/my-issues/all' }) })}</div>` : ''}
    ${own.length ? `<section class="i6-sec" aria-labelledby="pr-mine"><h2 class="i6-h" id="pr-mine">Yours</h2>${left.length ? box(left.map(i => prepRow(i)).join('')) : ''}${doneFold('own-done', own.filter(isDone), i => prepRow(i))}</section>` : ''}
    ${help.length ? `<section class="i6-sec" aria-labelledby="pr-help"><h2 class="i6-h" id="pr-help">Helping</h2>${box(help.map(i => prepRow(i, { helper: true })).join(''))}</section>` : ''}
    ${drafts.length ? `<section class="i6-sec" aria-labelledby="pr-dr"><h2 class="i6-h" id="pr-dr">Not public yet</h2>${box(drafts.map(i => prepRow(i)).join(''))}</section>` : ''}
    ${listsLine()}
  </div>`;
}

// Between sessions, My issues opens as the prep list for anyone with an issue to get ready (myissues.js).
export const myIssuesPrep = () => !!SESSION_OVER && !!S.me && (mine().length + helping().length + myDrafts().length) > 0;
export const renderMinePrep = () => mineRender({ asMyIssues: true });
export const wireMinePrep = () => {};

// ---- the Prep board (F165): an admin's view of All issues, #/my-issues/all?view=prep ----
// Every issue, its owner, its steps, and what is waiting for an admin; each owner's progress; Tell the owners.
const FILTERS = [['all', 'All'], ['wait', 'Waiting for you'], ['sent_back', 'Changes asked'], ['todo', 'No steps done yet'], ['top', 'Top issues'], ['draft', 'Not public yet']];
const inFilter = (i, f) => f === 'all' ? !isDraft(i) : f === 'top' ? !isDraft(i) && (i.top_pick === 'yes' || !!i.recommended) : f === 'wait' ? stateOf(i) === 'ready' : f === 'draft' ? isDraft(i) : stateOf(i) === f;
const B = () => S.prBoard ??= { f: null, who: null };
// Top issues (R-288): what the owner said, and the button that confirms it (the pre-tick).
const topSays = i => { const o = ownerOfIssue(i), who = o ? first(o) : 'The owner'; return i.top_pick === 'yes' ? `${who} says: top issue` : i.top_pick === 'no' ? `${who} says: not a top issue` : `${who} has not answered`; };
const topBtn = i => btn(i.recommended ? 'Confirmed' : 'Confirm', { kind: 'secondary', sm: true, icon: i.recommended ? 'circle-check' : 'star', attrs: { 'data-prtop': i.id, 'aria-pressed': String(!!i.recommended), 'aria-label': `Confirm ${i.name} as a top issue` } });
function boardRow(i, top = false) {
  const o = ownerOfIssue(i), k = stateOf(i);
  const line = top ? topSays(i) : isDraft(i) ? prepLine(i).t : `${doneN(i)} of ${STEPS.length} steps${['ready', 'approved', 'sent_back'].includes(k) ? ` · ${stateWords(i)}` : ''}`;
  const own = btn(o ? ownerName(o) : 'No owner', { kind: 'secondary', sm: true, iconEnd: 'chevron-down', attrs: { 'data-prown': i.id, 'aria-haspopup': 'dialog', 'aria-label': `Owner of ${i.name}: ${o ? ownerName(o) : 'nobody'}. Change` } });
  return itemRow({ key: i.id, name: i.name, line: nw(esc(line)), icon: k === 'approved' ? 'circle-check' : '', tone: k === 'approved' ? 'done' : '', href: issueHref(i, 'board'), button: top ? topBtn(i) : own, cls: 'i6-row' });
}
function boardBody(f, who) {
  const rows = live().filter(i => inFilter(i, f) && (!who || i.owner_id === who));
  if (!rows.length) return `<p class="i6-quiet">${f === 'wait' ? 'Nothing is waiting for you.' : f === 'draft' ? 'No issue is waiting to go public.' : f === 'top' ? 'No owner has put an issue forward yet. Owners answer this as a step on each issue.' : 'None.'}</p>`;
  const lede = f === 'top' ? `<p class="i6-quiet">${plural(rows.filter(i => i.top_pick === 'yes').length, 'issue')} put forward by owners, ${rows.filter(i => i.recommended).length} confirmed. Confirming pre-ticks the issue for first-time visitors who pick its category; nothing on the public page says so.</p>` : '';
  return lede + (S.categories || []).map(c => { const l = rows.filter(i => i.category === c.key).sort(byName); return l.length ? `<section class="i6-sec" aria-labelledby="pr-c-${esc(c.key)}"><h2 class="i6-h i6-th" id="pr-c-${esc(c.key)}"><span class="i6-catic" aria-hidden="true">${icon(c.icon || 'tag')}</span><span>${esc(c.name)}</span></h2>${box(l.map(i => boardRow(i, f === 'top')).join(''))}</section>` : ''; }).join('');
}
function tellHTML() {
  const untold = live().filter(i => i.owner_id && !i.owner_told_at && !isDraft(i)), people = [...new Set(untold.map(i => i.owner_id))].map(advocate).filter(Boolean);
  const others = people.filter(a => a.id !== S.me?.id), noLogin = others.filter(a => a.auth_user_id === null);
  const told = live().some(i => i.owner_told_at);
  if (!others.length) return told ? lineHTML('check', 'Owners have been told. A new owner hears as soon as you change one.') : '';
  return `<section class="pr6-tell" aria-labelledby="pr-th"><h2 id="pr-th">${told ? `${plural(others.length, 'owner')} not told yet` : 'Nobody has been told yet'}</h2>
    <p>When the owners look right, tell them. Each gets one Slack message listing their issues and the due date. ${noLogin.length ? `<b>${esc(listWords(noLogin.map(first)))} cannot sign in yet</b>: make ${noLogin.length === 1 ? 'them a sign-in link' : 'each a sign-in link'} under <a href="#/people">People</a> first, or they cannot open the link.` : ''} Someone the tracker cannot reach is not sent one; Team shows who.</p>
    ${btn(`Tell ${plural(others.length, 'owner')}`, { kind: 'secondary', icon: 'send', attrs: { 'data-pr': 'tell' } })}</section>`;
}
// The view switch of All issues for admins: List · Prep board (F165; "List", since the tab above is All issues, C-15). A visible switch, not a "…" menu (rule 3).
export const boardSwitch = cur => isAdmin() ? `<div class="sv-seg i6-seg pr6-view" role="group" aria-label="All issues as a list, or the Prep board">${[['', 'List', '#/my-issues/all'], ['prep', 'Prep board', BOARD_HREF]].map(([v, l, h]) => `<a href="${h}" role="button" aria-pressed="${cur === v}">${l}</a>`).join('')}</div>` : '';
function boardRender(route) {
  const st = B(); if (route.q?.f && FILTERS.some(x => x[0] === route.q.f)) st.f = route.q.f;
  // W4: Today's "Behind: Rick 0/7" opens the board on that owner (once per link, so the buttons still change it).
  if (route.q?.who && st.whoQ !== route.q.who) { st.who = st.whoQ = route.q.who; st.f = 'all'; }
  const ok = live().filter(i => !isDraft(i)), counts = k => live().filter(i => inFilter(i, k) && (!st.who || i.owner_id === st.who)).length, n = ok.filter(i => stateOf(i) === 'approved').length;
  // Until someone picks a filter: what is waiting for the admin if anything is, otherwise everything.
  const f = st.f || (counts('wait') ? 'wait' : 'all');
  // W4: each owner's progress, least done first ("Kevin 4/10"), so who is behind shows without scanning.
  const perLine = ownerProgress().map(o => `<button type="button" class="pr6-whob" data-prwho="${esc(o.id)}" aria-pressed="${st.who === o.id}" aria-label="${esc(`${first(advocate(o.id))}: ${o.done} of ${o.total} ready or approved`)}">${esc(first(advocate(o.id)))} ${o.done}/${o.total}</button>`).join('');
  if (!isAdmin()) return `<div class="le-page i6-page">${headHTML('all')}<p class="i6-quiet">The Prep board is for admins. Your own issues for 2027 are under <a href="${prepListHref()}">My issues</a>.</p></div>`;
  return `<div class="le-page i6-page pr6-board">
    ${headHTML('all')}
    ${boardSwitch('prep')}
    <p class="pr6-lede">${esc(`${n} of ${ok.length} approved, ${pastDue() ? `still to finish (they were due ${dueText()})` : `due ${dueText()}`}. Owners work through their issues and mark them ready; you approve them or ask for changes.`)}</p>
    ${tellHTML()}
    ${listsLine()}
    ${perLine ? `<div class="pr6-per" role="group" aria-label="Show one owner's issues"><span class="pr6-perl">Owners</span>${perLine}${st.who ? btn('Everyone', { kind: 'text', sm: true, attrs: { 'data-prwho': '' } }) : ''}</div>` : ''}
    <div class="pr6-filters"><span>${esc(`Showing: ${FILTERS.find(x => x[0] === f)[1]}`)}</span>${filterBtn(f === 'all' ? 0 : 1, { 'data-prfilter': f })}</div>
    <div id="pr-body">${boardBody(f, st.who)}</div>
  </div>`;
}

export const prepView = route => ({ mine: 'mine', prep: 'prep' })[route?.q?.view] || null;
// The prep list is "Your issues for 2027" since My issues became each person's issues and their bills (R-263).
export const prepTitle = route => ({ mine: 'Your issues for 2027', prep: 'Prep board' })[prepView(route)] || '';
export const renderPrep = route => prepView(route) === 'mine' ? mineRender() : boardRender(route);
export function wirePrep(route, root) {
  if (prepView(route) !== 'prep') return;
  const st = B();
  root.querySelectorAll('[data-prown]').forEach(el => el.onclick = () => { const i = S.issues.find(x => x.id === el.dataset.prown); if (i) changeOwner(i); });
  // R-277 fix 20 (U-3): which issues show is the one Filter button (a pill switch only shows a list another way).
  root.querySelector('[data-prfilter]')?.addEventListener('click', e => { const counts = k => live().filter(i => inFilter(i, k) && (!st.who || i.owner_id === st.who)).length;
    pickerSheet({ title: 'Show', value: e.currentTarget.dataset.prfilter, options: FILTERS.map(([k, l]) => [k, l, null, k === 'all' ? '' : plural(counts(k), 'issue')]), onPick: val => { st.f = val; hooks.render(); requestAnimationFrame(() => document.querySelector('[data-prfilter]')?.focus()); } }); });
  root.querySelectorAll('[data-prwho]').forEach(el => el.onclick = () => { const id = el.dataset.prwho || null; st.who = st.who === id ? null : id; if (st.who) st.f = 'all'; hooks.render(); });
  root.querySelectorAll('[data-prtop]').forEach(el => el.onclick = () => { const i = S.issues.find(x => x.id === el.dataset.prtop); if (i) toggleTop(i); });
  root.querySelector('[data-pr="tell"]')?.addEventListener('click', async e => {
    const b = e.currentTarget; b.setAttribute('aria-busy', 'true'); b.disabled = true;
    // M1-1: say how many were actually sent a message, and name anyone the tracker could not reach.
    const asked = [...new Set(live().filter(i => i.owner_id && !i.owner_told_at && !isDraft(i)).map(i => i.owner_id))].filter(id => id !== S.me?.id);
    try { const n = await DB.tellIssueOwners(); hooks.render();
      let lost = []; try { const r = await DB.teamReach(); lost = asked.filter(id => !['slack', 'email', 'unknown'].includes(r.find(x => x.advocate_id === id)?.reach)).map(advocate).filter(Boolean); } catch { /* reach unknown */ }
      toast(`Sent to ${plural(n, 'owner')}. Each shows as told once their message arrives.${lost.length ? ` Not sent to ${listWords(lost.map(first))}: the tracker can't reach them (People).` : ''}`, { ok: !lost.length }); }
    catch (err) { toast(err, { err: true }); b.removeAttribute('aria-busy'); b.disabled = false; }
  });
}
