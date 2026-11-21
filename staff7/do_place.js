// R-398 piece 9 gap E: Track a bill from Search (Nate: "Track it, and you lead it", anyone on staff).
//   1. Search's page for a bill nobody tracks has the filled "Track this bill" (find.js draws it, this file does it): DB.track, then the lead through the data layer's setLeads (the call the Team page uses;
//      in memory while LEADS_V7 is off, the database's set_bill_leads after the switch, so the change also shows on the admin's "Look over N lead changes").
//   2. "HIPHI now tracks HB 100. You lead it." with Undo (toast and link), then the filled "Set its position and issue".
//   3. That page (#/do/pl-<number>): the position as a choice of one and the issue as a search with choices, nothing picked by default, each pick saves at once with a toast and Undo, filled Done goes back.
//   4. Until both are set the leader has the Home step "Set position and issue". It does not expire by the calendar: it ends by itself when both are set, or the bill is no longer tracked, or the person no longer leads it.
// Practice copy: "tracked from Search by me" is kept in this tab (sessionStorage, like do_check.js's record). Live (later) the same record would be the bill's activity row; staff7 is practice-only today.
import { S, DB, myIssueIds, publicPositionPending, isLiveBill } from '../staff6/data.js';
import { SESSION_YEAR } from '../staff6/data.js';
import { ic } from './icons7.js';
import { esc, btn, toast, plainBand } from './parts.js';
import { billNo, issueOf } from './steps.js';
import { titleCaseTitle } from '../staff6/model.js';
import { redrawKeep, rerender, dropIdx, norm, matchWords, otherBillRow } from './find.js';
import { eCig } from './issues.js';
import { moveBill } from './issue_edit.js';
import { setLeads as takeLead, undoLeads } from './team_data.js';
import { noteChange, dropChange } from './do_check.js';
import { publicKeeps, positionSavedNote } from './public_data.js';

const $ = id => document.getElementById(id);
const enc = encodeURIComponent, bare = n => String(n || '').replace(/\s/g, '').toUpperCase();
// Strongest support first, then the two that take no side, then oppose, then strongly oppose (the bill page's own list puts Strongly oppose before Oppose; this page reads in order).
const POS = [['strongly_support', 'Strongly support'], ['support', 'Support'], ['support_amend', 'Support with amendments'], ['monitor', 'Monitor'], ['neutral', 'Comments (neutral)'], ['oppose', 'Oppose'], ['strongly_oppose', 'Strongly oppose']];
const posName = v => (POS.find(p => p[0] === v) || [, ''])[1];

// ---------------------------------------------------------------------------------- the record: bills this person tracked from Search
const KEY = 'hiphi7_placed';
const store = (() => { try { const s = JSON.parse(sessionStorage.getItem(KEY)); if (s && typeof s === 'object') return s; } catch { /* fresh */ } return {}; })();
const persist = () => { try { sessionStorage.setItem(KEY, JSON.stringify(store)); } catch { /* it still works in memory */ } };
const justTracked = new Map();   // bill number -> { bill, recs }: the "now tracks" page while the person is on it

// the bill's name as the drawings say it: its nickname, else its title ("Relating to media literacy"), not the long official description
const nameOf = b => eCig(b.nickname || titleCaseTitle(b.title || '') || billNo(b));
const hasIssue = b => (S.billIssues || []).some(x => x.bill_id === b.id);
const isSet = b => !!b.position && hasIssue(b);
const stepId = b => `pl-${bare(b.bill_number)}`;
const billOf = id => { const k = String(id).replace(/^pl-/, ''); return (S.bills || []).find(b => bare(b.bill_number) === k) || null; };
const leads = (b, me) => !!me && (S.assignments?.[b.id] || []).includes(me.id);

// ---------------------------------------------------------------------------------- Search: the untracked bill's page, and tracking it
export const trackBox = r => `<p class="lead tight pact">${btn('Track this bill', { kind: 'filled', id: 'trackGo', attrs: `data-num="${esc(bare(r.bill_number))}"` })}</p>`
  + `<p class="hint" id="trackNote">You become its lead. You then set its position and issue.</p>`;

export async function trackIt(num) {
  const me = S.me, r = otherBillRow(num), go = $('trackGo'); if (!me || !r || r === 'loading') return;
  if (go) { go.disabled = true; go.setAttribute('aria-busy', 'true'); go.classList.add('is-loading'); }
  const bill = Object.assign({ ...r }, { referrals: r.referrals || [], sponsors: r.sponsors || [], companions: r.companions || [], session_year: r.session_year || SESSION_YEAR, position: r.position ?? null, priority: r.priority ?? null });
  const fail = () => { if (go) { go.disabled = false; go.removeAttribute('aria-busy'); go.classList.remove('is-loading'); } toast('We could not track that bill. Try again.'); };
  try { await DB.track(bill); } catch { return fail(); }
  let res; try { res = await takeLead([bill.id], me.id); } catch (e) { res = { refused: String(e?.message || 'refused') }; }
  if (res.refused) { try { await DB.untrack(bill.id); } catch { /* the bill stays tracked; the toast says what happened */ } return fail(); }
  const recs = res.recs || [];
  store[bill.id] = me.id; persist(); justTracked.set(bare(bill.bill_number), { bill, recs });
  dropIdx(); rerender();
  toast(`HIPHI now tracks ${billNo(bill)}. You lead it.`, { ms: 10000, undo: () => undoTrack(bill) });
}
async function undoTrack(bill) {
  const t = justTracked.get(bare(bill.bill_number)), recs = t?.recs || [];
  try { if (recs.length) { const u = await undoLeads(recs); if (u?.refused) throw new Error(u.refused); } await DB.untrack(bill.id); }
  catch { toast('We could not undo that. Try again.'); return; }
  delete store[bill.id]; persist(); justTracked.delete(bare(bill.bill_number));
  dropIdx(); rerender(); toast('Not tracked again.');
}
// The page after tracking (find.js draws it while the bill is in justTracked and still tracked).
export function trackedSheet(num) {
  const t = justTracked.get(bare(num)), b = t && (S.bills || []).find(x => x.id === t.bill.id && x.tracked !== false);
  if (!b) { justTracked.delete(bare(num)); return ''; }
  const done = isSet(b);
  return `<div class="pn" data-sheet="tracked"><div class="done enter tdone"><div class="dtile">${ic('check')}</div><h1 tabindex="-1" id="trackedH">${esc(`HIPHI now tracks ${billNo(b)}. You lead it.`)}</h1>`
    + `<p class="sub">${done ? 'Its position and issue are set.' : 'Its position and issue are not set yet.'}</p>`
    + (done ? '' : `<p class="hint">Undo takes it off the tracker again.</p><p class="pact">${btn('Undo', { kind: 'text', id: 'trackUndo', attrs: `data-num="${esc(bare(num))}"` })}</p>`)
    + `<p class="pact">${btn(done ? 'Change its position and issue' : 'Set its position and issue', { kind: 'filled', id: 'placeGo', href: `#/do/${enc(stepId(b))}` })}</p>`
    + `<p class="hint">${esc(nameOf(b).replace(/\.$/, ''))} ${esc(billNo(b))}</p></div></div>`;
}
export function bindTrack() {
  $('trackGo')?.addEventListener('click', ev => trackIt(ev.currentTarget.dataset.num));
  $('trackUndo')?.addEventListener('click', ev => { const t = justTracked.get(bare(ev.currentTarget.dataset.num)); if (t) undoTrack(t.bill); });
}

// ---------------------------------------------------------------------------------- Home: the step until both are set
const dayLabel = 'Today';
export function placeSteps(me) {
  if (!me) return [];
  const out = [];
  for (const b of S.bills || []) {
    if (!store[b.id] || b.tracked === false || !leads(b, me) || isSet(b)) continue;
    out.push({ id: stepId(b), kind: 'place', bill: b, hearing: null, draft: null, at: null, due: null, until: null, act: null, tone: 'neutral', late: false, issue: issueOf(b), name: nameOf(b).replace(/\.$/, ''), no: billNo(b),
      forWhom: '', sentBack: '', ask: null, verb: 'Set position and issue', mark: dayLabel });
  }
  return out;
}

// ---------------------------------------------------------------------------------- the page
const q = { id: null, q: '' };   // the words typed: kept across a redraw, dropped when another bill's page is drawn
const live = () => (S.issues || []).filter(i => !i.archived_at);
const LIMIT = 10;
function listOf(b) {
  const picked = new Set((S.billIssues || []).filter(x => x.bill_id === b.id).map(x => x.issue_id)), mine = new Set([...myIssueIds()].map(String)), ws = matchWords(q.q);
  let all = live(); if (q.q.trim()) all = ws.length ? all.filter(i => { const h = ' ' + norm(eCig(i.name)); return ws.every(alts => alts.some(a => h.includes(' ' + a))); }) : [];
  all = all.slice().sort((x, y) => (picked.has(y.id) - picked.has(x.id)) || (mine.has(String(y.id)) - mine.has(String(x.id))) || eCig(x.name).localeCompare(eCig(y.name), 'en'));
  return { shown: all.slice(0, LIMIT), total: all.length, picked };
}
function chipsHTML(b) {
  const { shown, total, picked } = listOf(b), searching = !!q.q.trim();
  const chips = shown.map(i => `<li><button type="button" class="bchip" data-issue="${esc(i.id)}" aria-pressed="${picked.has(i.id)}">${picked.has(i.id) ? ic('check') : ''}<span>${esc(eCig(i.name))}</span></button></li>`).join('');
  return (shown.length ? `<ul class="bchips" aria-label="Issues">${chips}</ul>` : '<p class="hint">No issue matches that. Try other words.</p>')
    + (total > LIMIT ? `<p class="hint">Showing ${LIMIT} of ${total} ${searching ? 'issues that match' : 'issues'}. Search to find ${searching ? 'it' : 'another'}.</p>` : '');
}
const radios = b => POS.map(([v, l]) => `<label class="bs"><input class="bsr" type="radio" name="plpos" id="pp-${v}" value="${v}"${b.position === v ? ' checked' : ''}><span>${ic('check')}${esc(l)}</span></label>`).join('');

export function placePage(id) {
  const b = billOf(id);
  if (!b || b.tracked === false) return null;
  if (q.id !== b.id) { q.id = b.id; q.q = ''; }
  const html = `<div class="pn" data-sheet="place">${plainBand(`Set ${billNo(b)}’s position and issue`, nameOf(b))}<div class="pbody bill bpick">`
    + `<p class="hint" id="plHint">Each pick saves at once.</p>`
    + `<fieldset class="bef"><legend class="fl">Position</legend><div class="bseg" id="plPos">${radios(b)}</div></fieldset>`
    + `<p class="hint" id="plNote">Not sure? Pick Monitor. An admin can change it later.</p>`
    + `<label class="fl" for="plIn">Issue</label><input class="field" id="plIn" type="text" autocomplete="off" spellcheck="false" placeholder="Search the issues by name or words" value="${esc(q.q)}">`
    + `<div id="plChips">${chipsHTML(b)}</div>`
    + `<div class="sfoot">${btn('Done', { kind: 'filled', id: 'plDone' })}</div></div></div>`;
  return { html, bind: () => bindPlace(b) };
}
async function savePosition(b, v) {
  const prev = b.position || null; let held = [];
  try { held = (await DB.updateBill(b.id, { position: v })) || []; } catch { toast('We could not save that. Try again.'); redrawKeep(); return; }
  if (held.includes('position')) { toast('Saved. The position waits for an admin’s yes.'); redrawKeep(); return; }
  noteChange(b, prev, v);
  const pub = isLiveBill(b) && publicPositionPending(b), lab = l => (l ? posName(l) : 'No position yet');
  redrawKeep();
  toast(pub ? positionSavedNote(lab(b.public_position), !!S.me?.is_admin) : `Position: ${posName(v)}`, { undo: async () => {
    try { await DB.updateBill(b.id, { position: prev }); dropChange(b); redrawKeep(); toast('Put back'); } catch { toast('We could not put that back.'); }
  } });
}
function bindPlace(b) {
  $('plPos')?.addEventListener('change', ev => { if (ev.target.name === 'plpos') savePosition(b, ev.target.value); });
  $('plIn')?.addEventListener('input', ev => { q.q = ev.target.value; $('plChips').innerHTML = chipsHTML(b); });
  $('plDone')?.addEventListener('click', () => $('tbBack')?.click());   // every pick is saved already: Done only goes back
  $('plChips')?.addEventListener('click', async ev => {
    const c = ev.target.closest('[data-issue]'); if (!c || c.disabled) return;
    const issue = (S.issues || []).find(i => i.id === c.dataset.issue); if (!issue) return;
    c.disabled = true;
    const done = await moveBill(issue, b, c.getAttribute('aria-pressed') !== 'true', { style: 'bill', me: S.me, after: () => redrawKeep() });
    if (!done) c.disabled = false;
  });
}
