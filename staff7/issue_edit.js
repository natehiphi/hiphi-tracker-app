// The issue page's edits (R-398): "Change the lead", the issue's goal and its own talking points. Only the issue's lead or an admin sees the buttons; everyone else looks. Every save goes through
// DB.updateIssue (the data layer's own call, so the same code works live), shows the page's usual saved/failed message and, when it fails, keeps what was typed. What is open or typed lives in `eui`,
// so the minute's redraw (and the redraw after a save) keeps it.
import { S, DB } from '../staff6/data.js';
import { esc, btn, toast } from './parts.js';
import { first } from './steps.js';
import { redrawKeep } from './find.js';
import { eCig } from './issues.js';

export const eui = { id: null, lead: null, goal: null, tp: null };   // id: the issue the three belong to (issue.js clears them when another issue is drawn); each: null (closed) or { text|sel, busy, err }
const $ = id => document.getElementById(id);
export const mayEditIssue = (issue, me) => !!me && (issue.owner_id === me.id || !!me.is_admin);
export const pointsOf = issue => (Array.isArray(issue.talking_points) ? issue.talking_points : []).map(x => String(x?.text ?? x ?? '').trim()).filter(Boolean);
const errP = (id, on, words) => `<p class="hint berr" id="${id}" role="alert"${on ? '' : ' hidden'}>${esc(words)}</p>`;
const FAIL = 'We could not save that. Try again.';

// ---------------------------------------------------------------------------------- the lead
export const leadButton = () => btn('Change the lead', { kind: 'text', id: 'iLeadGo', attrs: 'aria-expanded="false" aria-controls="iLeadF"' });
export function leadForm(issue, me) {
  const e = eui.lead, people = S.advocates.filter(a => a.is_active !== false || a.id === issue.owner_id).slice().sort((x, y) => (y.id === me?.id) - (x.id === me?.id) || first(x).localeCompare(first(y), 'en'));
  const opts = people.map(a => `<option value="${esc(a.id)}"${e.sel === a.id ? ' selected' : ''}>${esc(first(a))}${a.id === me?.id ? ' (you)' : ''}</option>`).join('');
  return `<form class="bedit" id="iLeadF" novalidate><div class="bef"><label class="fl" for="iLeadSel">Who leads this issue</label><select class="field bsel" id="iLeadSel">${opts}</select>`
    + '<p class="hint">On the real tracker the new lead is told by Slack or email. Only the lead or an admin can change it again.</p></div>'
    + `<div class="beact">${btn('Save', { kind: 'filled', id: 'iLeadSave', disabled: e.sel === issue.owner_id || e.busy, loading: !!e.busy }).replace('type="button"', 'type="submit"')}${btn('Cancel', { kind: 'text', id: 'iLeadCancel' })}</div>`
    + `${errP('iLeadErr', e.err, FAIL)}<p class="hint">Each bill keeps its own position and lead. Change those on the bill’s page.</p></form>`;
}

// ---------------------------------------------------------------------------------- the goal and the talking points
const teamOnly = '<span class="to">team only</span>';
export function goalCell(issue, can) {
  const e = eui.goal, g = String(issue.goal || '').trim();
  if (e) return `<form class="bedit" id="iGoalF" novalidate><div class="bef"><label class="fl" for="iGoalIn">The goal for this session. Only the team sees it.</label><textarea class="field" id="iGoalIn" rows="3" maxlength="1000">${esc(e.text)}</textarea></div>`
    + `<div class="beact">${btn('Save the goal', { kind: 'filled', id: 'iGoalSave', disabled: e.busy, loading: !!e.busy }).replace('type="button"', 'type="submit"')}${btn('Cancel', { kind: 'text', id: 'iGoalCancel' })}</div>${errP('iGoalErr', e.err, FAIL)}</form>`;
  return `${g ? `${esc(eCig(g))} ` : ''}${can ? btn(g ? 'Change' : 'Add a goal', { kind: 'text', id: 'iGoalGo' }) : g ? '' : '<span class="m">None written</span>'}${teamOnly}`;
}
// own points: listed; none: the caller says where a bill's points are; `fallback` is that HTML
export function pointsCell(issue, can, fallback) {
  const e = eui.tp, pts = pointsOf(issue);
  if (e) return `<form class="bedit" id="iTpF" novalidate><div class="bef"><label class="fl" for="iTpIn">Talking points: 3 to 5 short points, one on each line. Only the team sees them.</label><textarea class="field" id="iTpIn" rows="6">${esc(e.text)}</textarea></div>`
    + `<div class="beact">${btn('Save the points', { kind: 'filled', id: 'iTpSave', disabled: e.busy, loading: !!e.busy }).replace('type="button"', 'type="submit"')}${btn('Cancel', { kind: 'text', id: 'iTpCancel' })}</div>${errP('iTpErr', e.err, e.err === 'count' ? 'Write 3 to 5 points, one on each line, or none.' : FAIL)}</form>`;
  const go = can ? btn(pts.length ? 'Change' : 'Write the issue’s own', { kind: 'text', id: 'iTpGo' }) : '';
  return pts.length ? `<ul class="btalk shown">${pts.map(t => `<li>${esc(eCig(t))}</li>`).join('')}</ul>${go}${teamOnly}` : `${fallback || '<span class="m">None written</span>'}${fallback && go ? ' · ' : ''}${go}${teamOnly}`;
}

// ---------------------------------------------------------------------------------- saving
const clearErr = (e, id) => { if (e.err) { e.err = false; const p = $(id); if (p) p.hidden = true; } };   // typing or choosing again takes the old failure message away
const focusLater = id => setTimeout(() => $(id)?.focus(), 0);
// `prev` null: no Undo (a lead who hands the issue on cannot take it back: the database refuses, so the toast must not offer it)
async function save(key, issue, patch, prev, words, failFocus) {
  const e = eui[key]; if (!e || e.busy) return;
  e.busy = true; e.err = false; redrawKeep();
  try {
    await DB.updateIssue(issue.id, patch);
  } catch { e.busy = false; e.err = true; redrawKeep(); focusLater(failFocus); return; }   // the block stays open, the typed words stay in it
  if (eui[key] === e) eui[key] = null;   // the person may have moved to another issue while it saved
  redrawKeep();
  if (!prev) { toast(words); return; }
  toast(words, { undo: async () => { try { await DB.updateIssue(issue.id, prev); redrawKeep(); toast('Put back'); } catch { toast('We could not put that back.'); } } });
}

export function bindEdit(issue, me) {
  $('iLeadGo')?.addEventListener('click', () => { eui.lead = { sel: issue.owner_id || '', busy: false, err: false }; redrawKeep(); focusLater('iLeadSel'); });
  $('iGoalGo')?.addEventListener('click', () => { eui.goal = { text: String(issue.goal || ''), busy: false, err: false }; redrawKeep(); focusLater('iGoalIn'); });
  $('iTpGo')?.addEventListener('click', () => { eui.tp = { text: pointsOf(issue).join('\n'), busy: false, err: false }; redrawKeep(); focusLater('iTpIn'); });
  const close = (key, goId) => { eui[key] = null; redrawKeep(); focusLater(goId); };
  const lf = $('iLeadF');
  if (lf) {
    const e = eui.lead;
    lf.addEventListener('change', ev => { if (ev.target.id === 'iLeadSel') { e.sel = ev.target.value; clearErr(e, 'iLeadErr'); const s = $('iLeadSave'); if (s && !e.busy) s.disabled = e.sel === issue.owner_id; } });
    lf.addEventListener('submit', ev => { ev.preventDefault(); if (e.sel === issue.owner_id) return; const who = S.advocates.find(a => a.id === e.sel); save('lead', issue, { owner_id: e.sel }, null, `Lead changed to ${who ? first(who) : 'nobody'}.`, 'iLeadSave'); });
    lf.addEventListener('keydown', ev => { if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); close('lead', 'iLeadGo'); } });
    $('iLeadCancel').addEventListener('click', () => close('lead', 'iLeadGo'));
  }
  const gf = $('iGoalF');
  if (gf) {
    const e = eui.goal; $('iGoalIn').addEventListener('input', ev => { e.text = ev.target.value; clearErr(e, 'iGoalErr'); });
    gf.addEventListener('submit', ev => { ev.preventDefault(); const t = e.text.trim(); save('goal', issue, { goal: t || null }, { goal: issue.goal ?? null }, t ? 'Goal saved' : 'Goal cleared', 'iGoalSave'); });
    gf.addEventListener('keydown', ev => { if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); close('goal', 'iGoalGo'); } });
    $('iGoalCancel').addEventListener('click', () => close('goal', 'iGoalGo'));
  }
  const tf = $('iTpF');
  if (tf) {
    const e = eui.tp; $('iTpIn').addEventListener('input', ev => { e.text = ev.target.value; clearErr(e, 'iTpErr'); });
    tf.addEventListener('submit', ev => {
      ev.preventDefault(); const pts = e.text.split('\n').map(s => s.trim()).filter(Boolean);
      if (pts.length && (pts.length < 3 || pts.length > 5)) { e.err = 'count'; redrawKeep(); focusLater('iTpIn'); return; }
      save('tp', issue, { talking_points: pts.length ? pts : null, talking_points_edited_at: new Date().toISOString() }, { talking_points: issue.talking_points ?? null, talking_points_edited_at: issue.talking_points_edited_at ?? null }, pts.length ? 'Talking points saved' : 'Talking points cleared', 'iTpSave');
    });
    tf.addEventListener('keydown', ev => { if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); close('tp', 'iTpGo'); } });
    $('iTpCancel').addEventListener('click', () => close('tp', 'iTpGo'));
  }
}
