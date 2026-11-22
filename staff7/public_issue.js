// Staff7's public mode for one issue (R-398 piece 10 part D). The page at #/public/issue/<issue id>: frame.js draws it in public mode (no app bar, no left column, the plum look),
// and this is the one place an issue goes on the public site or comes off it. Nothing on a tracker page can do either (S-8): the issue's page only opens this one.
//   - Only an admin may be here. Anyone else sees that only the admin publishes, and a way back.
//   - A draft that is ready: the words to read once more on the left, the preview as the public site will show it on the right, and the docked "Publish to the public site".
//     A draft that is not ready says what it still needs, the way the database does (issue_missing, migration 091), and the button stays off.
//   - Publishing is at once (the person pressing it is the admin who decides); the done page keeps Undo for 10 seconds. A published issue's page has "Take it off the public site", with Undo.
//   - Live, publishing is one update of the issue's row, the same one the current app makes (staff6/prep.js, "publish"): published_at, and prep_state approved with the two "checked" stamps.
//     The database (issues_prep_guard) checks the person is an admin and that nothing is missing; this page checks the same so a refusal is said before the press.
import { S, DB, advocate, isLiveBill } from '../staff6/data.js';
import { billName, billNo } from './steps.js';
import { ic } from './icons7.js';
import { esc, btn, toast } from './parts.js';
import { eCig } from './issues.js';
import { pointsOf } from './issue_edit.js';
import { adminFirst, BAND, LEAVE_PUBLIC, LEAVE_SHORT, PREVIEW_HEAD, PREVIEW_TAG, PUBLISH_BUTTON } from './public_data.js';

const TEN = 10000, enc = encodeURIComponent, $ = id => document.getElementById(id);
export const ISSUE_PUBLISH_LINE = 'The public can find and follow it from then on.';
export const TAKE_OFF = 'Take it off the public site';
export const TAKE_OFF_LINE = 'The public can no longer find or follow it. Nothing is deleted, and you can publish it again.';
export const BACK_TO_ISSUE = 'Back to the issue';
export const GOAL_LINE = 'The goal is for the team only and is not shown.';
export const CHANGE_WORDS = 'Change these words on the issue’s page';
const POINTS_HELP = 'They show under the issue. People tap them into testimony sent in their own name.';
const NUM = { 3: 'three', 4: 'four', 5: 'five' };
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const joinAnd = l => l.length < 2 ? l.join('') : `${l.slice(0, -1).join(', ')} and ${l[l.length - 1]}`;
const firstOf = id => { const a = id ? advocate(id) : null; return (a?.full_name || '').split(' ')[0] || 'Someone'; };
const issueOf = id => (S.issues || []).find(x => String(x.id) === String(id)) || null;
const topicName = i => (S.categories || []).find(c => c.key === i.category)?.name || '';
const billsOn = i => (S.billIssues || []).filter(x => x.issue_id === i.id).map(x => (S.bills || []).find(b => b.id === x.bill_id)).filter(Boolean);
// what the public would really see of its bills: tracked, on the public site, not archived
const publicBillsOn = i => billsOn(i).filter(b => isLiveBill(b) && !b.archived_at);

// What the database would say is missing (issue_missing, 091), in its own words and order.
export function issueMissing(i) {
  const m = [];
  if ((i.name || '').trim().length < 2) m.push('a name');
  if (!i.category) m.push('a topic');
  if (!(i.description || '').trim()) m.push('a description');
  if (!(i.goal || '').trim()) m.push('a goal');
  if (pointsOf(i).length < 3) m.push('three talking points');
  if (!i.owner_id) m.push('a lead');
  if (!billsOn(i).length) m.push('a bill');
  return m;
}
const needsLine = m => `It needs ${joinAnd(m)} before it can be published.`;
const startedLine = i => {
  const who = firstOf(i.created_by || i.owner_id), m = issueMissing(i);
  if (m.length) return `${who} started it as a draft. ${needsLine(m)}`;
  const n = pointsOf(i).length, b = billsOn(i).length;
  return `${who} started it as a draft. It has a goal, ${NUM[n] || n} talking points and ${plural(b, 'bill', 'bills')}.`;
};

let view = null, undoT = 0;   // view: { id, done: null | { at, prev } }
addEventListener('hashchange', () => { if (view && !location.hash.startsWith('#/public/issue/')) { view = null; clearTimeout(undoT); } });   // leaving the page ends its done moment; frame.js draws after this

export function publicIssuePage({ id }) {
  if (!view || view.id !== id) view = { id, done: null };
  return { html: pageHTML(), bind };
}

const toIssue = () => `#/issue/${enc(view.id)}`;   // the page's own buttons go to the issue; the band's Back and Close are the frame's (where the person came from)
function bandHTML(name) {
  return `<header class="pub-band"><div class="pub-wrap"><p class="pub-band-words"><b>${esc(BAND)}</b>${name ? `<span class="pub-band-bill">${esc(name)}</span>` : ''}</p>`
    + `<a class="btn quiet" href="${esc(toIssue())}"><span class="pub-long">${esc(LEAVE_PUBLIC)}</span><span class="pub-short">${esc(LEAVE_SHORT)}</span></a></div></header>`;
}
function emptyHTML(h1, name) {
  return `<div class="pub" id="pubRoot">${bandHTML(name)}<div class="pub-wrap pub-empty pi-empty"><h1 id="pubH1" tabindex="-1">${esc(h1)}</h1><p class="pi-back">${btn(BACK_TO_ISSUE, { kind: 'filled', href: toIssue(), attrs: 'data-issue-back' })}</p></div></div>`;
}

function pageHTML() {
  const i = issueOf(view.id), me = S.me;
  if (!i || i.archived_at) return emptyHTML('That issue is not here.', '');
  const name = eCig(i.name);
  if (!me?.is_admin) return emptyHTML(`Only ${adminFirst() || 'an admin'} publishes an issue.`, name);
  if (view.done) return doneHTML(i, name);
  return reviewHTML(i, name);
}

function reviewHTML(i, name) {
  const live = !!i.published_at, m = issueMissing(i), pts = pointsOf(i), all = billsOn(i), pub = publicBillsOn(i), topic = topicName(i);
  const status = live
    ? `<p class="pub-st1"><b>On the public site</b></p><p class="pub-st2">The public can find and follow it now. The words below are the words they see.</p>`
    : `<p class="pub-st1">Not on the public site yet</p><p class="pub-st2">${esc(startedLine(i))}</p>`;
  const hidden = all.length - pub.length;
  const note = hidden > 0 ? `<p class="pi-note">${esc(`${plural(hidden, 'bill on it is', 'bills on it are')} not on the public site, so the public will not see ${hidden === 1 ? 'it' : 'them'} listed.`)}</p>` : '';
  const left = `<section class="pi-left"><p class="pi-kind">Issue${topic ? ` · ${esc(topic)}` : ''}</p><h1 id="pubH1" tabindex="-1">${esc(name)}</h1>`
    + `<div class="pub-status" role="status" id="piStatus">${status}${note}</div>`
    + `<h2 class="pi-h">Topic</h2><p class="pi-t">${topic ? esc(topic) : '<span class="pi-none">None chosen</span>'}</p>`
    + `<h2 class="pi-h">Description</h2><p class="pi-t">${(i.description || '').trim() ? esc(eCig(i.description.trim())) : '<span class="pi-none">None written</span>'}</p>`
    + `<h2 class="pi-h">Talking points</h2><p class="pi-help">${esc(POINTS_HELP)}</p>`
    + (pts.length ? `<ol class="pi-pts">${pts.map(p => `<li>${esc(eCig(p))}</li>`).join('')}</ol>` : '<p class="pi-t"><span class="pi-none">None written</span></p>')
    + `<p class="pi-goal">${esc(GOAL_LINE)} <a class="pub-link" id="piChange" href="#/issue/${enc(i.id)}">${esc(CHANGE_WORDS)}</a></p></section>`;
  const side = `<section class="pub-side"><h2 class="pub-pv-h">${esc(PREVIEW_HEAD)}</h2><div class="pub-card" id="pubCard" tabindex="0" role="region" aria-label="${esc(PREVIEW_HEAD)}">${previewHTML(i, topic, pts, pub)}</div></section>`;
  const dock = live
    ? `${btn(TAKE_OFF, { kind: 'quiet', id: 'piOff' })}<p class="pub-dock-line" id="pubLine" aria-live="polite">${esc(TAKE_OFF_LINE)}</p>`
    : `<button type="button" class="btn filled pub-go${m.length ? ' off' : ''}" id="piGo" aria-disabled="${m.length ? 'true' : 'false'}">${esc(PUBLISH_BUTTON)}</button>`
      + `<p class="pub-dock-line" id="pubLine" aria-live="polite">${esc(m.length ? needsLine(m) : ISSUE_PUBLISH_LINE)}</p>`;
  return `<div class="pub" id="pubRoot">${bandHTML(name)}<div class="pub-wrap pub-grid">${left}${side}</div><footer class="pub-dock" id="pubDock"><div class="pub-wrap" id="pubDockIn">${dock}</div></footer></div>`;
}

// The picture of the public issue page (pub/rec/issue.js): the name, the topic, the one sentence, the talking points, its bills the public sees, and the follow row. Not pressable.
function previewHTML(i, topic, pts, pub) {
  return `<div class="pv-head"><span>Issue</span><span class="pv-label">${esc(PREVIEW_TAG)}</span></div>`
    + `<h3 class="pv-title">${esc(eCig(i.name))}</h3>`
    + (topic ? `<p class="pv-pos">${esc(topic)}</p>` : '')
    + ((i.description || '').trim() ? `<p class="pv-sum">${esc(eCig(i.description.trim()))}</p>` : '')
    + (pts.length ? `<div class="pv-tp"><h4>Talking points</h4><ul>${pts.map(p => `<li>${esc(eCig(p))}</li>`).join('')}</ul></div>` : '')
    + `<div class="pv-tp"><h4>Bills</h4>${pub.length ? `<ul>${pub.map(b => `<li>${esc(b.nickname || billName(b))} · ${esc(billNo(b))}</li>`).join('')}</ul>` : '<p class="pv-sum">No bill on it is on the public site yet.</p>'}</div>`
    + `<div class="pi-follow" aria-hidden="true"><b>Follow this issue</b><span>to hear when its bills move</span></div>`;
}

function doneHTML(i, name) {
  const left = Date.now() - view.done.at < TEN;
  return `<div class="pub" id="pubRoot">${bandHTML(name)}<div class="pub-wrap pi-done"><span class="pi-tick" aria-hidden="true">${ic('check')}</span>`
    + `<h1 id="pubH1" tabindex="-1">Published.</h1><p class="pi-done-line">The public can find and follow ${esc(name)}.</p>`
    + `<p class="pi-undo" id="piUndoRow"${left ? '' : ' hidden'}><button type="button" class="btn text pi-undo-b" id="piUndo">Undo</button><span>for 10 seconds</span></p>`
    + `<p class="pi-done-more">Later, you can take it off the public site from the issue’s page.</p>`
    + `<p class="pi-back">${btn(BACK_TO_ISSUE, { kind: 'filled', href: toIssue(), id: 'piBack', attrs: 'data-issue-back' })}</p></div></div>`;
}

function paint(focusId = 'pubH1') {
  const app = $('app'); if (!app || !view) return;
  const keep = [...document.querySelectorAll('#app .pub-band .pub-wrap > #tbBack, #app .pub-band .pub-wrap > #tbClose')].map(e => e.outerHTML);   // the frame's Back and Close, kept through a redraw from here
  app.innerHTML = pageHTML();
  const w = document.querySelector('#app .pub-band .pub-wrap');
  if (w && keep.length === 2) { w.querySelector(':scope > a.btn')?.remove(); w.insertAdjacentHTML('afterbegin', keep[0]); w.insertAdjacentHTML('beforeend', keep[1]); }
  bind();
  ($(focusId) || $('pubH1'))?.focus({ preventScroll: true });
}

function bind() {
  const root = $('pubRoot'); if (!root) return;
  root.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.id === 'piGo') publish();
    else if (b.id === 'piOff') takeOff();
    else if (b.id === 'piUndo') undoPublish();
  });
  const dock = $('pubDock');
  if (dock) { const h = dock.offsetHeight + 24; root.style.paddingBottom = h + 'px'; document.documentElement.style.setProperty('--dock-clear', h + 'px'); }
  if (view?.done) { clearTimeout(undoT); const left = TEN - (Date.now() - view.done.at); if (left > 0) undoT = setTimeout(() => { if ($('piUndoRow')) $('piUndoRow').hidden = true; }, left + 50); }
  $('pubH1')?.focus({ preventScroll: true });
}

// What publishing writes, as the current app does it (staff6/prep.js): the admin's approval of the whole issue, so its prep steps count as done. `prev` is what Undo puts back.
const KEYS = ['published_at', 'prep_state', 'wording_checked_at', 'outlook_checked_at', 'proposal', 'proposal_into'];
async function publish() {
  const i = issueOf(view.id); if (!i || !S.me?.is_admin || i.published_at) return;
  const m = issueMissing(i);
  if (m.length) { toast(needsLine(m), { ms: 6000 }); return; }   // as the database would: "Before it can be published it needs ..."
  const prev = Object.fromEntries(KEYS.map(k => [k, i[k] ?? null])), at = new Date().toISOString();
  const go = $('piGo'); if (go) go.setAttribute('aria-disabled', 'true');
  try { await DB.updateIssue(i.id, { published_at: at, prep_state: 'approved', wording_checked_at: i.wording_checked_at || at, outlook_checked_at: i.outlook_checked_at || at, proposal: 'keep', proposal_into: null }); }
  catch (e) { toast((e && e.message) || 'It did not go. The issue is still a draft.', { ms: 6000 }); if (go) go.setAttribute('aria-disabled', 'false'); return; }
  view.done = { at: Date.now(), prev }; paint('pubH1');
}
async function undoPublish() {
  const d = view?.done, i = issueOf(view.id); if (!d || !i || Date.now() - d.at >= TEN + 300) return;
  try { await DB.updateIssue(i.id, { ...d.prev, published_at: null }); }
  catch (e) { toast((e && e.message) || 'It could not be undone.', { ms: 6000 }); return; }
  view.done = null; clearTimeout(undoT); paint('piGo'); toast(`${eCig(i.name)} is a draft again. The public cannot see it.`, { ms: 6000 });
}
async function takeOff() {
  const i = issueOf(view.id); if (!i || !S.me?.is_admin || !i.published_at) return;
  const was = i.published_at;
  try { await DB.updateIssue(i.id, { published_at: null }); }
  catch (e) { toast((e && e.message) || 'It did not go. It is still on the public site.', { ms: 6000 }); return; }
  paint('piGo');
  toast(`${eCig(i.name)} is off the public site.`, { ms: TEN, undo: async () => {
    try { await DB.updateIssue(i.id, { published_at: was }); } catch (e) { toast((e && e.message) || 'It could not be put back.', { ms: 6000 }); return; }
    if ($('pubRoot') && view?.id === i.id) paint('piOff'); } });
}
