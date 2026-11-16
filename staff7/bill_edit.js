// The bill page's Part C (R-398): the two things a person can change here. (1) "Change position or lead" opens an edit block IN PLACE of the position line: the position (a radio group drawn as a
// segmented row, from the data layer's own POSITIONS) and the lead (a select), Save and Cancel. (2) "Add a note for the team" above the notes: a note is a message in the bill's team conversation.
// Everything is written through the data layer (DB.updateBill, DB.setOwner, DB.addActivity, DB.sendMessage, DB.deleteMessage, the same calls staff6's own bill page makes), so the same code works live
// later; on the practice copy those change memory only. What is open or typed lives in bill.js's `bui`, so the minute's redraw (and a redraw after a save) keeps it.
// Staff6's own bill page lets any team member change the position and the owner; the rule here is Nate's: the lead, the owner of the bill's issue (own), or an admin.
import { S, DB, DEMO, DEMO_TL, POSITIONS } from '../staff6/data.js';
import { ic } from './icons7.js';
import { esc, btn, toast } from './parts.js';
import { first } from './steps.js';
import { leadIds } from './bill_words.js';
import { refreshTimeline } from './bill_data.js';
import { redrawKeep } from './find.js';
import { bui } from './bill.js';

const $ = id => document.getElementById(id);
const OPTS = [...POSITIONS.filter(p => p[0]), ['', 'No position yet']];   // the data layer's own list and labels; clearing is allowed (staff6's picker has "No position")
const curLead = (b, issue) => leadIds(b, issue)[0] || '';
const canEdit = (b, issue, me, own) => !!me && (leadIds(b, issue).includes(me.id) || !!own || !!me.is_admin);
export const mayEdit = canEdit;
const dirty = (b, issue) => { const e = bui.edit; return !!e && (e.pos !== (b.position || '') || e.lead !== curLead(b, issue)); };

// ---------------------------------------------------------------------------------- 1. position and lead
export const editButton = () => btn('Change position or lead', { kind: 'text', id: 'bEditGo', attrs: 'aria-expanded="false" aria-controls="bEdit"' });
export function editHTML(b, issue, me) {
  const e = bui.edit, people = S.advocates.filter(a => a.is_active !== false || a.id === e.lead).slice().sort((x, y) => (y.id === me?.id) - (x.id === me?.id) || first(x).localeCompare(first(y), 'en'));
  const radios = OPTS.map(([v, l]) => `<label class="bs"><input class="bsr" type="radio" name="bpos" id="bp-${v || 'none'}" value="${esc(v)}"${e.pos === v ? ' checked' : ''}><span>${esc(l)}</span></label>`).join('');
  const sel = `<option value=""${e.lead === '' ? ' selected' : ''}>Nobody</option>${people.map(a => `<option value="${esc(a.id)}"${e.lead === a.id ? ' selected' : ''}>${esc(first(a))}</option>`).join('')}`;
  return `<form class="bedit" id="bEdit" novalidate><fieldset class="bef"><legend class="fl">Position</legend><div class="bseg">${radios}</div></fieldset>`
    + `<div class="bef"><label class="fl" for="bLeadSel">Lead</label><select class="field bsel" id="bLeadSel">${sel}</select></div>`
    + `<div class="beact">${btn('Save', { kind: 'filled', id: 'bSave', disabled: !dirty(b, issue) || e.busy, loading: !!e.busy }).replace('type="button"', 'type="submit"')}${btn('Cancel', { kind: 'text', id: 'bCancel' })}${b.is_public ? '<span class="hint">The position shows on the public site.</span>' : ''}</div>`
    + `<p class="hint berr" id="bEditErr" role="alert"${e.err ? '' : ' hidden'}>We could not save that. Try again.</p></form>`;
}
const openEdit = () => {
  const { b, issue } = bui.ctx; bui.edit = { id: b.id, pos: b.position || '', lead: curLead(b, issue), err: false, busy: false };
  redrawKeep(); ($('bEdit')?.querySelector('input:checked') || $('bEditGo'))?.focus();
};
const closeEdit = () => { bui.edit = null; redrawKeep(); $('bEditGo')?.focus(); };
async function save() {
  const { b, issue } = bui.ctx, e = bui.edit; if (!e || e.busy || !dirty(b, issue)) return;
  const posChanged = e.pos !== (b.position || ''), leadChanged = e.lead !== curLead(b, issue), prev = { pos: b.position || '', lead: curLead(b, issue) }, rows = [];
  e.busy = true; e.err = false; redrawKeep();
  let held = [], posDone = false;
  try {
    if (posChanged) { held = (await DB.updateBill(b.id, { position: e.pos || null })) || []; posDone = !held.includes('position'); }
    if (leadChanged) { try { await DB.setOwner(b.id, e.lead || null); } catch (x) { if (posDone) await DB.updateBill(b.id, { position: prev.pos || null }).catch(() => {}); throw x; } }
  } catch { e.busy = false; e.err = true; redrawKeep(); return; }
  // the history: a lead change is recorded here (nothing else records it); the real database records a position change itself, so only the practice copy writes that row, to show it
  const rec = async (field, old, nw) => { try { await DB.addActivity(b.id, 'field_change', field === 'lead' ? 'Lead changed' : 'Position changed', JSON.stringify({ field, old: old || null, new: nw || null })); if (DEMO) rows.push(DEMO_TL[0]); } catch { /* the save stands; the history line is only a record of it */ } };
  if (posDone && DEMO) await rec('position', prev.pos, e.pos);
  if (leadChanged) await rec('lead', prev.lead, e.lead);
  await refreshTimeline(b);
  const after = { pos: e.pos, lead: e.lead }; bui.edit = null; redrawKeep(); $('bEditGo')?.focus();
  const undo = async () => {
    try {
      if (posDone) await DB.updateBill(b.id, { position: prev.pos || null });
      if (leadChanged) await DB.setOwner(b.id, prev.lead || null);
      // practice: take the rows this save added back out of the history; live: Undo is another save, so it is recorded like one
      if (DEMO) rows.forEach(r => { const i = DEMO_TL.indexOf(r); if (i >= 0) DEMO_TL.splice(i, 1); });
      else if (leadChanged) await DB.addActivity(b.id, 'field_change', 'Lead changed', JSON.stringify({ field: 'lead', old: after.lead || null, new: prev.lead || null })).catch(() => {});
      await refreshTimeline(b); redrawKeep(); toast('Put back');
    } catch { toast('We could not put that back.'); }
  };
  toast(held.includes('position') ? 'Saved. The position waits for an admin’s yes.' : 'Saved', { undo });
}

// ---------------------------------------------------------------------------------- 2. add a note
const NOTE_MAX = 4000;   // staff6's own team-chat box (activity.js) holds 4,000 letters
export function noteBoxHTML(b) {
  const v = bui.note.get(b.id) || '', empty = !v.trim();
  return `<div class="bnadd" id="bNoteBox"><label class="fl" for="bNoteIn">Add a note for the team</label><textarea class="field" id="bNoteIn" rows="3" maxlength="${NOTE_MAX}">${esc(v)}</textarea>`
    + `<div class="bnact">${btn('Add the note', { kind: 'quiet', id: 'bNoteGo', disabled: empty || bui.noteBusy, loading: !!bui.noteBusy })}<span class="hint">Only the team sees notes.</span></div>`
    + `<p class="hint berr" id="bNoteErr" role="alert"${bui.noteErr ? '' : ' hidden'}>We could not save that. Try again.</p></div>`;
}
async function addNote() {
  const { b } = bui.ctx, text = (bui.note.get(b.id) || '').trim(); if (!text || bui.noteBusy) return;
  bui.noteBusy = true; bui.noteErr = false; redrawKeep();
  try {
    const m = await DB.sendMessage(b.id, text);
    bui.note.delete(b.id); bui.noteBusy = false; redrawKeep();
    toast('Note added', { undo: async () => { try { await DB.deleteMessage(m); redrawKeep(); toast('Put back'); } catch { toast('We could not put that back.'); } } });
  } catch { bui.noteBusy = false; bui.noteErr = true; redrawKeep(); }   // the words stay in the box
}

// ---------------------------------------------------------------------------------- wiring
export function bindEdit() {
  $('bEditGo')?.addEventListener('click', openEdit);
  const f = $('bEdit');
  if (f) {
    const { b, issue } = bui.ctx, e = bui.edit, sync = () => { const s = $('bSave'); if (s && !e.busy) s.disabled = !dirty(b, issue); };
    f.addEventListener('change', ev => { if (ev.target.name === 'bpos') e.pos = ev.target.value; else if (ev.target.id === 'bLeadSel') e.lead = ev.target.value; sync(); });
    f.addEventListener('submit', ev => { ev.preventDefault(); save(); });
    f.addEventListener('keydown', ev => { if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); closeEdit(); } });
    $('bCancel').addEventListener('click', closeEdit);
  }
  const t = $('bNoteIn');
  if (t) {
    const { b } = bui.ctx, go = $('bNoteGo');
    t.addEventListener('input', () => { bui.note.set(b.id, t.value); bui.noteSel = [t.selectionStart, t.selectionEnd]; if (go && !bui.noteBusy) go.disabled = !t.value.trim(); });
    t.addEventListener('keyup', () => { bui.noteSel = [t.selectionStart, t.selectionEnd]; });
    t.addEventListener('focus', () => { if (bui.noteSel) try { t.setSelectionRange(bui.noteSel[0], bui.noteSel[1]); } catch { /* none */ } });
    go?.addEventListener('click', addNote);
  }
}
