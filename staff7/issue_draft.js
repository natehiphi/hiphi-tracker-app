// Staff7's draft issue page parts (R-398 piece 10): the mark "Draft · not on the public site", the block "Before it goes public" (four rows whose ticks are WORKED OUT from the data, never stored: S-10),
// the fields that save as the person leaves them, "Remove this draft" with its Undo, and, for an admin on a ready draft, the way into public mode. The lead and admins fill the lines; others look.
// Saving goes through DB.updateIssue, the same call issue_edit.js uses (a draft's words are never held for an admin; only a published issue's are).
import { S, DB } from '../staff6/data.js';
import { esc, btn, toast } from './parts.js';
import { redrawKeep } from './find.js';
import { ic } from './icons7.js';
import { eCig } from './issues.js';
import { first, billNo, billName } from './steps.js';
import { pointsOf, eui } from './issue_edit.js';
import { adminFirst } from './issue_new.js';

const $ = id => document.getElementById(id);
const enc = encodeURIComponent;
export const isDraft = issue => !issue.published_at && !issue.archived_at;
export const draftMark = () => `<p class="bsub dmark"><span class="dmk" aria-hidden="true">${ic('circle')}</span><span><b>Draft</b> · not on the public site</span></p>`;

// what the person has typed and not yet saved, per issue (a redraw keeps it); which rows are open for changing; which rows said "Saved"
export const dui = { id: null, txt: {}, edit: {}, saved: {}, tpN: 3, err: {} };
const reset = id => { if (dui.id !== id) { dui.id = id; dui.txt = {}; dui.edit = {}; dui.saved = {}; dui.tpN = 3; dui.err = {}; } };

// ---------------------------------------------------------------------------------- what is missing (worked out from the data)
export const billRows = issue => (S.billIssues || []).filter(x => x.issue_id === issue.id);
export function checks(issue) {
  return { desc: !!String(issue.description || '').trim(), goal: !!String(issue.goal || '').trim(), tp: pointsOf(issue).length >= 3, bill: billRows(issue).length > 0 };
}
const NEEDS = [['desc', 'a description'], ['goal', 'a goal'], ['tp', 'three talking points'], ['bill', 'a bill']];
export const missingOf = issue => { const c = checks(issue); return NEEDS.filter(([k]) => !c[k]).map(x => x[1]); };
const list = a => a.length < 2 ? a.join('') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`;
export const closingLine = issue => { const m = missingOf(issue); return m.length ? `Needs ${list(m)} before ${adminFirst()} can publish it.` : `Ready. It is on ${adminFirst()}’s list to publish.`; };
export const doneCount = issue => Object.values(checks(issue)).filter(Boolean).length;

export const mayFill = (issue, me) => !!me && (issue.owner_id === me.id || !!me.is_admin);
export const mayRemove = (issue, me) => mayFill(issue, me) || (!!me && issue.created_by === me.id);

// ---------------------------------------------------------------------------------- the block
const tick = on => `<span class="nick${on ? ' on' : ''}" aria-hidden="true">${ic(on ? 'circle-check' : 'circle')}</span><span class="sr">${on ? 'Done: ' : 'Not done: '}</span>`;
const savedTag = k => `<span class="nisaved" id="dSaved-${k}"${dui.saved[k] ? '' : ' hidden'}>${ic('check')}Saved</span>`;
const errTag = (k, words) => `<p class="nierr" id="dErr-${k}" role="alert"${dui.err[k] ? '' : ' hidden'}>${dui.err[k] ? ic('circle-alert') : ''}<span>${esc(words)}</span></p>`;
const FAIL = 'We could not save that. Your words are still here.';
const row = (k, title, c, body, act = '') => `<div class="nirow${c ? ' nidone' : ''}" id="dRow-${k}" data-row="${k}"><div class="nirh">${tick(c)}<h3>${esc(title)}</h3>${savedTag(k)}${act}</div><div class="nibody" id="dBody-${k}">${body}</div></div>`;
const lines = (issue, me) => {
  const lead = (S.advocates || []).find(a => a.id === issue.owner_id);
  return lead && issue.owner_id !== me?.id ? `<p class="hint">${esc(first(lead))} leads this draft and fills these in. You can read them here.</p>` : '';
};
const textVal = (k, issue) => dui.txt[k] ?? String(issue[k === 'desc' ? 'description' : 'goal'] || '');

function textRow(k, issue, me, c, title, hint, max, rows) {
  const can = mayFill(issue, me), val = textVal(k, issue), editing = dui.edit[k] || !c;
  let body = hint && !(c && !editing) ? `<p class="hint nih">${esc(hint)}</p>` : '', act = '';
  if (!can) body += val.trim() ? `<p class="nitext">${esc(eCig(val))}</p>` : '<p class="hint">Not written yet.</p>';
  else if (editing) body += `<textarea class="field" id="d-${k}" rows="${rows}" maxlength="${max}" aria-label="${esc(title)}">${esc(val)}</textarea>${errTag(k, FAIL)}`;
  else { body += `<p class="nitext">${esc(eCig(val))}</p>`; act = btn('Change', { kind: 'text', id: `dChange-${k}`, attrs: `data-k="${k}" aria-label="Change ${esc(title.toLowerCase())}"` }); }
  return row(k, title, c, body, act);
}
function tpFieldHTML(i, v, can) { return `<div class="nitp"><label class="fl" for="d-tp-${i}">Talking point ${i + 1}</label><input class="field" id="d-tp-${i}" type="text" maxlength="200" autocomplete="off" value="${esc(v)}"${can ? '' : ' readonly'}></div>`; }
function tpRow(issue, me, c) {
  const can = mayFill(issue, me), pts = dui.txt.tp ?? pointsOf(issue), editing = dui.edit.tp || !c;
  let body = c && !editing ? '' : '<p class="hint nih">Up to five, each under 200 characters. They show on the public site under the issue.</p>', act = '';
  if (!can) body += pts.length ? `<ul class="nipts">${pts.map(t => `<li>${esc(eCig(t))}</li>`).join('')}</ul>` : '<p class="hint">Not written yet.</p>';
  else if (editing) {
    const n = Math.min(5, Math.max(3, dui.tpN, pts.length));
    body += `<div id="dTpList">${Array.from({ length: n }, (_, i) => tpFieldHTML(i, pts[i] || '', true)).join('')}</div>${errTag('tp', FAIL)}${n < 5 ? btn('Add another', { kind: 'text', id: 'dTpAdd' }) : ''}`;
  } else { body += `<ul class="nipts">${pts.map(t => `<li>${esc(eCig(t))}</li>`).join('')}</ul>`; act = btn('Change', { kind: 'text', id: 'dChange-tp', attrs: 'data-k="tp" aria-label="Change the talking points"' }); }
  return row('tp', 'At least three talking points', c, body, act);
}
function billRow(issue, c) {
  const bs = billRows(issue).map(x => (S.bills || []).find(b => b.id === x.bill_id)).filter(Boolean);
  let body = bs.length ? `<p class="nitext">${bs.length} ${bs.length === 1 ? 'bill' : 'bills'}: ${bs.map(b => `${esc(eCig(billName(b)))} <span class="nino">${esc(billNo(b))}</span>`).join(', ')}</p>`
    : `<p class="hint nih">Put a bill on it so the team and the public can follow it.</p>`;
  body += btn(bs.length ? 'Change the bills' : 'Put a bill on it', { kind: 'quiet', id: 'dBillGo', icon: bs.length ? '' : 'plus' });
  return row('bill', 'A bill on it', c, body);
}
// the admin's way in to public mode, only on a ready draft; nothing on this page publishes
function readyHTML(issue, me) {
  if (!me?.is_admin || missingOf(issue).length) return '';
  return `${btn('Open in public mode to publish', { kind: 'filled', id: 'dPublicGo', href: `#/public/issue/${enc(issue.id)}`, big: true })}<p class="hint">Nothing changes on the public site until you publish there.</p>`;
}

export function draftBlock(issue, me) {
  reset(issue.id);
  const c = checks(issue), n = doneCount(issue), can = mayFill(issue, me);
  const removal = mayRemove(issue, me) ? `<div class="nirm">${btn('Remove this draft', { kind: 'text', id: 'dRemove' })}</div>` : '';
  return `<section class="nibox" id="dBlock" aria-labelledby="dH"><div class="nibh"><h2 id="dH">Before it goes public</h2><p class="nicount" id="dCount">${n} of 4 done</p></div>`
    + `<p class="hint nisave">${can ? 'Saves as you type.' : ''}</p>${can ? '' : lines(issue, me)}`
    + textRow('desc', issue, me, c.desc, 'A description', 'One sentence on what would change. The public sees it once it is published.', 240, 3)
    + textRow('goal', issue, me, c.goal, 'A goal for 2027', 'What we want to win. Staff only.', 600, 4)
    + tpRow(issue, me, c.tp) + billRow(issue, c.bill)
    + `<p class="niclose${missingOf(issue).length ? '' : ' ok'}" id="dClose">${esc(closingLine(issue))}</p>${removal}</section>`
    + `<div class="niready" id="dReady">${readyHTML(issue, me)}</div>`;
}

// ---------------------------------------------------------------------------------- behaviour
const focusLater = id => setTimeout(() => $(id)?.focus(), 0);
// the ticks, the count and the closing line are drawn again in place (a redraw would take the cursor out of the next field)
function refresh(issue, me) {
  const c = checks(issue);
  for (const [k] of NEEDS) { const r = $(`dRow-${k}`); if (!r) continue; r.classList.toggle('nidone', c[k]); const t = r.querySelector('.nick'); t.classList.toggle('on', c[k]); t.innerHTML = ic(c[k] ? 'circle-check' : 'circle'); const s = r.querySelector('.sr'); if (s) s.textContent = c[k] ? 'Done: ' : 'Not done: '; }
  const cnt = $('dCount'); if (cnt) cnt.textContent = `${doneCount(issue)} of 4 done`;
  const cl = $('dClose'); if (cl) { cl.textContent = closingLine(issue); cl.classList.toggle('ok', !missingOf(issue).length); }
  const rd = $('dReady'); if (rd) rd.innerHTML = readyHTML(issue, me);
}
async function saveField(k, issue, me) {
  const patch = k === 'desc' ? { description: ($('d-desc').value || '').trim() || null } : k === 'goal' ? { goal: ($('d-goal').value || '').trim() || null }
    : { talking_points: (() => { const p = [...document.querySelectorAll('#dTpList input')].map(i => i.value.trim()).filter(Boolean); return p.length ? p : null; })() };
  const key = k === 'desc' ? 'description' : k === 'goal' ? 'goal' : 'talking_points';
  if (JSON.stringify(patch[key] ?? null) === JSON.stringify(issue[key] ?? null)) return;   // nothing changed since the last save
  if (k === 'tp') patch.talking_points_edited_at = new Date().toISOString();
  try { await DB.updateIssue(issue.id, patch); }
  catch { dui.err[k] = true; const e = $(`dErr-${k}`); if (e) { e.hidden = false; e.innerHTML = `${ic('circle-alert')}<span>${esc(FAIL)}</span>`; } toast(FAIL); return; }   // the typed words stay in the field
  dui.err[k] = false; const e = $(`dErr-${k}`); if (e) { e.hidden = true; e.innerHTML = ''; }
  delete dui.txt[k]; dui.saved[k] = true; const tag = $(`dSaved-${k}`); if (tag) tag.hidden = false;
  refresh(issue, me);
}
const archiveIso = () => new Date().toISOString();

async function removeDraft(issue) {
  const rows = billRows(issue).map(x => (S.bills || []).find(b => b.id === x.bill_id)).filter(Boolean), nm = eCig(issue.name);
  const onNone = rows.filter(b => !(S.billIssues || []).some(x => x.bill_id === b.id && x.issue_id !== issue.id && (S.issues || []).some(i => i.id === x.issue_id && !i.archived_at)));
  const was = issue.archived_at ?? null;
  try {
    await DB.updateIssue(issue.id, { archived_at: archiveIso() });
    for (const b of rows) await DB.setBillIssue(b.id, issue.id, false);
  } catch {
    try { for (const b of rows) await DB.setBillIssue(b.id, issue.id, true); if (issue.archived_at) await DB.updateIssue(issue.id, { archived_at: was }); } catch { /* the page is redrawn from what the data says */ }
    toast('We could not remove the draft. Nothing changed.'); redrawKeep(); return;
  }
  const k = onNone.length, words = !rows.length ? `Removed the draft ${nm}.` : k === rows.length ? `Removed the draft ${nm}. ${k === 1 ? 'Its 1 bill is' : `Its ${k} bills are`} on no issue now.` : k ? `Removed the draft ${nm}. ${k === 1 ? '1 of its bills is' : `${k} of its bills are`} on no issue now.` : `Removed the draft ${nm}. ${rows.length === 1 ? 'Its bill stays' : 'Its bills stay'} on ${rows.length === 1 ? 'its' : 'their'} other ${rows.length === 1 ? 'issue' : 'issues'}.`;
  addEventListener('hashchange', () => toast(words, { ms: 10000, undo: async () => {
    try { await DB.updateIssue(issue.id, { archived_at: was }); for (const b of rows) await DB.setBillIssue(b.id, issue.id, true); redrawKeep(); toast(`Put back the draft ${nm}.`); }
    catch { toast('We could not put that back.'); }
  } }), { once: true });
  location.hash = '#/issues';
}

export function bindDraft(issue, me) {
  if (!$('dBlock')) return;
  const can = mayFill(issue, me);
  if (can) {
    const blk = $('dBlock');
    blk.addEventListener('input', ev => {   // what is typed is kept in memory, so a redraw never takes it away
      const t = ev.target;
      if (t.id === 'd-desc') { dui.txt.desc = t.value; dui.edit.desc = true; }
      else if (t.id === 'd-goal') { dui.txt.goal = t.value; dui.edit.goal = true; }
      else if (/^d-tp-/.test(t.id)) { dui.txt.tp = [...document.querySelectorAll('#dTpList input')].map(i => i.value).filter(v => v.trim()); dui.edit.tp = true; }
      else return;
      const k = t.id === 'd-desc' ? 'desc' : t.id === 'd-goal' ? 'goal' : 'tp';
      dui.saved[k] = false; const s = $(`dSaved-${k}`); if (s) s.hidden = true;
    });
    blk.addEventListener('focusout', ev => {   // each field saves as the person leaves it
      const t = ev.target, k = t.id === 'd-desc' ? 'desc' : t.id === 'd-goal' ? 'goal' : /^d-tp-/.test(t.id) ? 'tp' : '';
      if (!k) return;
      if (k === 'tp' && blk.querySelector('#dTpList')?.contains(ev.relatedTarget)) return;   // moving between the points is not leaving them
      saveField(k, issue, me);
    });
    blk.querySelectorAll('[id^="dChange-"]').forEach(b => b.addEventListener('click', () => { dui.edit[b.dataset.k] = true; redrawKeep(); focusLater(b.dataset.k === 'tp' ? 'd-tp-0' : `d-${b.dataset.k}`); }));
    $('dTpAdd')?.addEventListener('click', () => {
      const l = $('dTpList'), n = l.children.length; if (n >= 5) return;
      l.insertAdjacentHTML('beforeend', tpFieldHTML(n, '', true)); dui.tpN = n + 1;
      if (n + 1 >= 5) $('dTpAdd').remove();
      $(`d-tp-${n}`).focus();
    });
  }
  $('dBillGo')?.addEventListener('click', () => { eui.bills = { q: '' }; redrawKeep(); focusLater('iPutIn'); });
  $('dRemove')?.addEventListener('click', () => removeDraft(issue));
}
