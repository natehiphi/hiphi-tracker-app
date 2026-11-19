// The bill page's Part C (R-398): the two things a person can change here. (1) "Change position or lead" opens an edit block IN PLACE of the position line: the position (a radio group drawn as a
// segmented row, from the data layer's own POSITIONS) and the lead (a select), Save and Cancel. (2) "Add a note for the team" above the notes: a note is a message in the bill's team conversation.
// Everything is written through the data layer (DB.updateBill, DB.setOwner, DB.addActivity, DB.sendMessage, DB.deleteMessage, the same calls staff6's own bill page makes), so the same code works live
// later; on the practice copy those change memory only. What is open or typed lives in bill.js's `bui`, so the minute's redraw (and a redraw after a save) keeps it.
import { S, DB, DEMO, DEMO_TL, POSITIONS, isLiveBill, publicPositionPending, barMet } from '../staff6/data.js';
import { ic } from './icons7.js';
import { esc, btn, toast } from './parts.js';
import { first } from './steps.js';
import { refreshTimeline } from './bill_data.js';
import { redrawKeep } from './find.js';
import { bui } from './bill.js';
import { positionSaveNote, positionStillSays, positionSavedNote, publicKeeps, PUBLISH_CHANGE, SEE_IT, WRITE_THEM, missingLine, waitingState } from './public_data.js';

const $ = id => document.getElementById(id);
const OPTS = [...POSITIONS.filter(p => p[0]), ['', 'No position yet']];   // the data layer's own list and labels; clearing is allowed (staff6's picker has "No position")
const posLabel = v => (OPTS.find(o => o[0] === v) || [])[1] || 'No position yet';
// R-398 part 3 (design 7): the public site's position, in the words the picker uses; what the public site still says
const labelOf = v => v ? (POSITIONS.find(p => p[0] === v) || [, v])[1] : 'No position yet';
const enc = encodeURIComponent, normNo = s => String(s ?? '').replace(/\s/g, '').toUpperCase();
// The team's position differs from the public site's while the bill's words are public: the words say so before saving, and after it the line under the position says so
const pubDiff = (b, pos) => isLiveBill(b) && (pos || null) !== (b.public_position ?? null);
// "The public site still says Support · Waiting on Nate to publish · See it" (a non-admin with the three things), "· needs a nickname · Write them" (without them), "· Publish the change" (an admin)
export function posAfterHTML(b, me) {
  if (!publicPositionPending(b)) return '';
  const no = normNo(b.bill_number), link = (href, text) => `<a class="lk" href="${href}">${esc(text)}</a>`;
  const miss = missingLine(b), rest = me?.is_admin ? link(`#/public/change/${enc('position-' + no)}`, PUBLISH_CHANGE)
    : (barMet(b) || !miss) ? `${esc(waitingState())} · ${link(`#/public/${enc(no)}`, SEE_IT)}`
    : `${esc(miss.replace(/^Needs /, 'needs '))} · ${link(`#/public/${enc(no)}`, WRITE_THEM)}`;
  return `<p class="bposafter" id="bPosAfter"><span class="bpg" aria-hidden="true">${ic('globe')}</span><span>${esc(positionStillSays(labelOf(b.public_position)))} · ${rest}</span></p>`;
}
// Who may change them (Nate): the bill's assigned lead, the owner of the bill's issue, or an admin. Not a follower or a helper. (Staff6's own bill page lets any team member.)
export const mayEdit = (b, issue, me) => !!me && ((S.assignments?.[b.id] || []).includes(me.id) || (!!issue && issue.owner_id === me.id) || !!me.is_admin);
// The lead the form edits is the bill's REAL assignment, never the issue owner who stands in for it on the page
const realLeads = b => [...(S.assignments?.[b.id] || [])];
const curLead = b => realLeads(b)[0] || '';
const dirty = b => { const e = bui.edit; return !!e && (e.pos !== (b.position || '') || e.lead !== curLead(b)); };
const here = b => !!bui.ctx && bui.ctx.b.id === b.id;   // a save that finishes after the person went to another bill must not draw or focus that page

// ---------------------------------------------------------------------------------- 1. position and lead
export const editButton = () => btn('Change position or lead', { kind: 'text', id: 'bEditGo', attrs: 'aria-expanded="false" aria-controls="bEdit"' });
export function editHTML(b, issue, me) {
  const e = bui.edit, owner = issue && issue.owner_id ? S.advocates.find(a => a.id === issue.owner_id && a.is_active !== false) : null;
  const people = S.advocates.filter(a => a.is_active !== false || a.id === e.lead).slice().sort((x, y) => (y.id === me?.id) - (x.id === me?.id) || first(x).localeCompare(first(y), 'en'));
  const radios = OPTS.map(([v, l]) => `<label class="bs"><input class="bsr" type="radio" name="bpos" id="bp-${v || 'none'}" value="${esc(v)}"${e.pos === v ? ' checked' : ''}><span>${ic('check')}${esc(l)}</span></label>`).join('');
  const none = owner ? `${first(owner)}, who leads the issue` : 'Nobody';   // with no one assigned the page names the issue's owner as lead: the empty choice says so
  const sel = `<option value=""${e.lead === '' ? ' selected' : ''}>${esc(none)}</option>${people.map(a => `<option value="${esc(a.id)}"${e.lead === a.id ? ' selected' : ''}>${esc(first(a))}</option>`).join('')}`;
  return `<form class="bedit" id="bEdit" novalidate><fieldset class="bef"><legend class="fl">Position</legend><div class="bseg">${radios}</div></fieldset>`
    + `<div class="bef"><label class="fl" for="bLeadSel">Lead</label><select class="field bsel" id="bLeadSel">${sel}</select></div>`
    + `<p class="hint bposn" id="bPosSave"${pubDiff(b, e.pos) ? '' : ' hidden'}>${esc(positionSaveNote(labelOf(b.public_position)))}</p>`
    + `<div class="beact">${btn('Save', { kind: 'filled', id: 'bSave', disabled: !dirty(b) || e.busy, loading: !!e.busy }).replace('type="button"', 'type="submit"')}${btn('Cancel', { kind: 'text', id: 'bCancel' })}${b.is_public ? '<span class="hint">The position shows on the public site.</span>' : ''}</div>`
    + `<p class="hint berr" id="bEditErr" role="alert"${e.err ? '' : ' hidden'}>${esc(e.err === 'held' ? 'We could not save the lead. The position still waits for an admin’s yes.' : 'We could not save that. Try again.')}</p></form>`;
}
const openEdit = () => {
  const { b } = bui.ctx; bui.edit = { id: b.id, pos: b.position || '', lead: curLead(b), err: false, busy: false };
  redrawKeep(); ($('bEdit')?.querySelector('input:checked') || $('bEditGo'))?.focus();
};
const closeEdit = () => { bui.edit = null; redrawKeep(); $('bEditGo')?.focus(); };
async function save() {
  const { b } = bui.ctx, e = bui.edit; if (!e || e.busy || !dirty(b)) return;
  const posChanged = e.pos !== (b.position || ''), leadChanged = e.lead !== curLead(b), prev = { pos: b.position || '', leads: realLeads(b) }, rows = [];
  e.busy = true; e.err = false; redrawKeep();
  let held = [], posDone = false;
  const failed = () => { e.busy = false; e.err = held.includes('position') ? 'held' : true; if (here(b)) { redrawKeep(); $('bSave')?.focus(); } };   // the block stays open, and the focus where it was (on Save)
  try {
    if (posChanged) { held = (await DB.updateBill(b.id, { position: e.pos || null })) || []; posDone = !held.includes('position'); }
    if (leadChanged) { try { await DB.setOwner(b.id, e.lead || null); } catch (x) { if (posDone) await DB.updateBill(b.id, { position: prev.pos || null }).catch(() => {}); throw x; } }
  } catch { return failed(); }
  // the history: a lead change is recorded here (nothing else records it); the real database records a position change itself, so only the practice copy writes that row, to show it
  const rec = async (field, old, nw) => { try { await DB.addActivity(b.id, 'field_change', field === 'lead' ? 'Lead changed' : 'Position changed', JSON.stringify({ field, old: old || null, new: nw || null })); if (DEMO) rows.push(DEMO_TL[0]); } catch { /* the save stands; the history line is only a record of it */ } };
  if (posDone && DEMO) await rec('position', prev.pos, e.pos);
  if (leadChanged) await rec('lead', prev.leads[0] || '', e.lead);
  await refreshTimeline(b);
  const after = e.lead, said = [posDone ? `Position: ${posLabel(e.pos)}` : '', leadChanged ? `Lead: ${e.lead ? first(S.advocates.find(a => a.id === e.lead)) : 'Nobody'}` : ''].filter(Boolean).join(' · ');
  if (here(b)) { bui.edit = null; redrawKeep(); $('bEditGo')?.focus(); }
  const undo = async () => {
    try {
      if (posDone) await DB.updateBill(b.id, { position: prev.pos || null });
      if (leadChanged) await DB.setOwner(b.id, prev.leads[0] || null);   // exactly the list there was: none, or the one
      // practice: take the rows this save added back out of the history; live: Undo is another save, so it is recorded like one
      if (DEMO) rows.forEach(r => { const i = DEMO_TL.indexOf(r); if (i >= 0) DEMO_TL.splice(i, 1); });
      else if (leadChanged) await DB.addActivity(b.id, 'field_change', 'Lead changed', JSON.stringify({ field: 'lead', old: after || null, new: prev.leads[0] || null })).catch(() => {});
      await refreshTimeline(b); if (here(b)) redrawKeep(); toast('Put back');
    } catch { toast('We could not put that back.'); }
  };
  // Undo is offered only when something was saved, and not for a lead change that replaced SEVERAL assigned leads: setOwner leaves one, so the list could not be put back exactly. None is offered rather than a wrong one.
  const canUndo = (posDone || leadChanged) && !(leadChanged && prev.leads.length > 1);
  const pubPending = posDone && !held.includes('position') && isLiveBill(b) && publicPositionPending(b);   // the public site keeps its position until it is published
  if (!posDone && !leadChanged) toast('Saved. The position waits for an admin’s yes.');
  else if (pubPending) toast(leadChanged ? `${said}. ${publicKeeps(labelOf(b.public_position), !!S.me?.is_admin)}` : positionSavedNote(labelOf(b.public_position), !!S.me?.is_admin), canUndo ? { undo } : {});
  else toast(held.includes('position') ? `${said}. The position waits for an admin’s yes.` : said, canUndo ? { undo } : {});
}

// ---------------------------------------------------------------------------------- 2. add a note
const NOTE_MAX = 4000;   // staff6's own team-chat box (activity.js) holds 4,000 letters
// The box is closed until it is wanted: one quiet button where it stands. It is open when the person opened it (kept in bui.noteOpen across the minute's redraw) or has words typed in it.
const noteOpen = b => bui.noteOpen === b.id || !!(bui.note.get(b.id) || '').trim();
export function noteBoxHTML(b) {
  if (!noteOpen(b)) return `<div class="bnadd closed" id="bNoteBox">${btn('Add a note', { kind: 'quiet', id: 'bNoteOpen', attrs: 'aria-expanded="false" aria-controls="bNoteBox"' })}</div>`;
  const v = bui.note.get(b.id) || '', empty = !v.trim();
  return `<div class="bnadd" id="bNoteBox"><label class="fl" for="bNoteIn">Add a note for the team</label><textarea class="field" id="bNoteIn" rows="3" maxlength="${NOTE_MAX}">${esc(v)}</textarea>`
    + `<div class="bnact">${btn('Add the note', { kind: 'quiet', id: 'bNoteGo', disabled: empty || bui.noteBusy, loading: !!bui.noteBusy })}<span class="hint">Only the team sees notes.</span></div>`
    + `<p class="hint berr" id="bNoteErr" role="alert"${bui.noteErr ? '' : ' hidden'}>We could not save that. Try again.</p></div>`;
}
const openNote = () => { const { b } = bui.ctx; bui.noteOpen = b.id; redrawKeep(); $('bNoteIn')?.focus(); };
const closeNote = () => { bui.noteOpen = null; redrawKeep(); $('bNoteOpen')?.focus(); };
async function addNote() {
  const { b } = bui.ctx, text = (bui.note.get(b.id) || '').trim(); if (!text || bui.noteBusy) return;
  bui.noteBusy = true; bui.noteErr = false; redrawKeep();
  try {
    const m = await DB.sendMessage(b.id, text);
    bui.note.delete(b.id); bui.noteBusy = false; bui.noteOpen = null; if (here(b)) { redrawKeep(); $('bNoteOpen')?.focus(); }   // after a note the box closes again, and the focus is on the button that opens it
    toast('Note added', { undo: async () => { try { await DB.deleteMessage(m); if (here(b)) redrawKeep(); toast('Put back'); } catch { toast('We could not put that back.'); } } });
  } catch { bui.noteBusy = false; bui.noteErr = true; if (here(b)) { redrawKeep(); $('bNoteGo')?.focus(); } }   // the words stay in the box, and the focus where it was (on the button)
}

// ---------------------------------------------------------------------------------- wiring
export function bindEdit() {
  $('bEditGo')?.addEventListener('click', openEdit);
  const f = $('bEdit');
  if (f) {
    const { b } = bui.ctx, e = bui.edit, sync = () => { const s = $('bSave'); if (s && !e.busy) s.disabled = !dirty(b); const pn = $('bPosSave'); if (pn) pn.hidden = !pubDiff(b, e.pos); };
    f.addEventListener('change', ev => { if (ev.target.name === 'bpos') e.pos = ev.target.value; else if (ev.target.id === 'bLeadSel') e.lead = ev.target.value; sync(); });
    f.addEventListener('submit', ev => { ev.preventDefault(); save(); });
    f.addEventListener('keydown', ev => { if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); closeEdit(); } });
    $('bCancel').addEventListener('click', closeEdit);
  }
  $('bNoteOpen')?.addEventListener('click', openNote);
  const t = $('bNoteIn');
  if (t) {
    const { b } = bui.ctx, go = $('bNoteGo');
    t.addEventListener('input', () => { bui.note.set(b.id, t.value); bui.noteSel = [t.selectionStart, t.selectionEnd]; if (go && !bui.noteBusy) go.disabled = !t.value.trim(); });
    t.addEventListener('keyup', () => { bui.noteSel = [t.selectionStart, t.selectionEnd]; });
    t.addEventListener('focus', () => { if (bui.noteSel) try { t.setSelectionRange(bui.noteSel[0], bui.noteSel[1]); } catch { /* none */ } });
    t.addEventListener('keydown', ev => { if (ev.key === 'Escape' && !t.value.trim() && !bui.noteBusy) { ev.preventDefault(); ev.stopPropagation(); closeNote(); } });   // Escape closes an empty box; words typed are never thrown away
    go?.addEventListener('click', addNote);
  }
}
