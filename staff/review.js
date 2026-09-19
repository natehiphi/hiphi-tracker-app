// Review mode (#/review, #/review/:id, plan 3.2): one approval per screen, a counter, and it moves to the next one on
// its own. Testimony drafts waiting for me (first approval for admins, second approval for reviewers, whatever the
// Mine/Team scope and whatever the bill's position), then action-alert emails someone else wrote. The buttons call the
// same DB.transition / DB.alertStep as the current app; the toast is written from the state the server hands back
// (a first testimony moves to second review, and the old app wrongly said "the owner gets a DM to file it").
import { S, DB, esc, fmtDT, advocate, hooks } from './data.js';
import { billNum, blurb, alertTarget, billById } from './model.js';
import { icon, btn, chip, stepBar, empty, notice, toast, openSheet, closeSheet } from './ui.js';
import { emailPreview } from './composer.js';
import { reviewQueue, hearingFor, testDue, cd, hearingLine, reviewerNames, needsSecond, HOVER, afterBack } from './today.js';

const first = id => (advocate(id)?.full_name || 'Someone').split(' ')[0];
const ago = iso => { if (!iso) return ''; const m = (Date.now() - new Date(iso)) / 6e4; return m < 1 ? 'just now' : m < 60 ? `${Math.round(m)} minutes ago` : m < 48 * 60 ? `${Math.round(m / 60)} hour${Math.round(m / 60) === 1 ? '' : 's'} ago` : fmtDT(iso); };
const typing = t => t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);

// The session: the queue as it stood when review started, so "2 of 3" stays true while items leave the live queue.
function session(route) {
  let r = S.tdRev;
  if (!r || (!route.id && r.done)) {
    const q = reviewQueue().map(x => x.key);
    // Opened on one item (a card's Review button): that item first, then the rest of the queue.
    if (route.id && route.id !== 'done' && q.includes(route.id)) q.unshift(...q.splice(q.indexOf(route.id), 1));
    r = S.tdRev = { keys: q, i: 0, log: [], skipped: [], done: false };
  }
  if (route.id && route.id !== 'done') {
    const at = r.keys.indexOf(route.id);
    if (at >= 0) r.i = at;
    else if (resolve(route.id)) { r.keys.splice(r.i, 0, route.id); }   // a link to one item that is not in my queue: show it, in place
  }
  return r;
}
// key -> the record it stands for, read fresh each time (the draft object changes after a transition).
function resolve(key) {
  if (!key) return null;
  if (key.startsWith('email-')) { const a = (S.alerts || []).find(x => String(x.id) === key.slice(6)); return a ? { type: 'email', key, a, b: a.bill_id ? billById(a.bill_id) : null } : null; }
  const d = Object.values(S.drafts || {}).flat().find(x => String(x.id) === key); if (!d) return null;
  const b = billById(d.bill_id), h = hearingFor(d); return b ? { type: 'draft', key, d, b, h, due: testDue(h) } : null;
}
// Still mine to decide? (Someone else may have acted, or it was a link to a draft past this step.)
const actionable = it => it.type === 'email' ? it.a.status === 'submitted' && S.me?.is_admin && it.a.author_id !== S.me?.id
  : (it.d.status === 'review' && S.me?.is_admin) || (it.d.status === 'second_review' && S.me?.is_reviewer);

function header(r, total) {
  const n = Math.min(r.i + 1, total);
  return `<div class="td-rvbar">
    <a class="iconbtn td-rvx" href="#/" data-back aria-label="Close review" title="Close review">${icon('x')}</a>
    <h2 class="td-rvh">Review <span class="td-rvn">· ${n} of ${total}</span></h2>
    ${btn('Skip', { kind: 'text', iconEnd: 'chevron-right', attrs: { 'data-skip': '1' } })}</div>`;
}
function draftBody(it) {
  const { d, b, h, due } = it, me = S.me || {}, own = d.submitted_by && d.submitted_by === me.id;
  const two = d.status === 'second_review';
  const who = two ? `Approved by ${esc(first(d.approved_by))} ${esc(ago(d.approved_at))}. It is this bill’s first testimony, so a reviewer signs off too.`
    : d.submitted_by ? `Sent by ${own ? 'you' : esc(first(d.submitted_by))} ${esc(ago(d.submitted_at))}` : 'Not sent by anyone yet';
  const stale = b.current_version && d.version !== b.current_version;
  return `<section class="card td-rvcard" aria-labelledby="td-rvb">
    <p class="td-rveb">${icon('file-text')}${two ? 'Second approval' : 'Testimony'}${own ? chip('Your own draft', 'info', 'user-round') : ''}</p>
    <h3 id="td-rvb" class="td-rvtitle"><span class="td-num">${esc(billNum(b))}</span> <span class="td-rvt">${esc(blurb(b, 160))}</span></h3>
    ${h ? `<p class="td-rvline">${icon('landmark')}<span>${hearingLine(h)}</span></p>` : `<p class="td-rvline muted">${icon('landmark')}<span>${esc(d.committee)} · no hearing date yet</span></p>`}
    ${due != null ? `<p class="td-rvline">${cd(due, 'due')}</p>` : ''}
    <p class="td-rvline">${icon('user-round')}<span>${who}</span></p>
    ${stale ? notice('warn', 'triangle-alert', `The bill is now ${esc(b.current_version)}; this draft was written for ${esc(d.version || 'the introduced bill')}.`) : ''}
    ${d.review_note ? `<blockquote class="td-q">${esc(d.review_note)}</blockquote>` : ''}
    ${stepBar(d.status, { second: needsSecond(d) })}
    ${d.doc_url ? btn('Open the Google Doc', { kind: 'secondary', full: true, href: d.doc_url, target: '_blank', icon: 'file-text', iconEnd: 'external-link', attrs: { 'data-doc': '1' } }) : `<p class="small muted">The Google Doc link is missing. Open the bill to find the draft.</p>`}
  </section>`;
}
function emailBody(it) {
  const a = it.a, n = S.tdAud?.[a.id];
  return `<section class="card td-rvcard" aria-labelledby="td-rvb">
    <p class="td-rveb">${icon('mail')}Email to supporters</p>
    <h3 id="td-rvb" class="td-rvtitle">${esc(a.subject || '(no subject)')}</h3>
    <p class="td-rvline">${icon('users')}<span>To ${n != null ? `${n} ${n === 1 ? 'person' : 'people'} who follow` : 'the people who follow'} ${esc(alertTarget(a))}</span></p>
    <p class="td-rvline">${icon('user-round')}<span>Sent by ${esc(first(a.author_id))} ${esc(ago(a.submitted_at || a.created_at))}</span></p>
    ${S.emailCfg?.enabled === false ? notice('info', 'mail', 'Email is paused. You can approve; nothing sends until it is turned back on.') : ''}
    <div class="td-rvmail">${emailPreview(a)}</div>
  </section>`;
}
// Skipped items that still wait for me (someone else may have decided them meanwhile).
const stillSkipped = r => r.skipped.filter(k => { const it = resolve(k); return it && actionable(it); });
function endScreen(r) {
  const decided = r.log.length, skipped = stillSkipped(r);
  const title = !r.keys.length ? 'Nothing to review.' : !decided ? 'Nothing reviewed yet.' : skipped.length ? `${decided} of ${r.keys.length} reviewed.` : r.keys.length === 1 ? 'Reviewed.' : `All ${decided} reviewed.`;
  const text = !r.keys.length ? 'Drafts and emails that need your approval show up here.' : '';
  return `<div class="td-rv td-rvend">${empty({ title, text })}
    ${decided ? `<div class="rows td-rvlog">${r.log.map(x => `<div class="row"><span class="lead">${icon(x.icon)}</span><span class="body"><span class="title"><span class="td-num">${esc(x.num)}</span></span><span class="sub">${esc(x.what)}</span></span></div>`).join('')}</div>` : ''}
    <div class="btncol td-rvendbtns">${skipped.length ? btn(`Review the ${skipped.length === 1 ? 'one' : skipped.length} you skipped`, { kind: 'secondary', attrs: { 'data-again': '1' } }) : ''}${btn('Back to Today', { href: '#/', attrs: { 'data-home': '1', 'data-back': true } })}</div></div>`;
}

function current(route) {
  const r = session(route);
  while (r.i < r.keys.length && !resolve(r.keys[r.i])) r.keys.splice(r.i, 1);   // gone (deleted or reloaded): drop it
  // The end screen only after something happened; a reload of #/review/done starts the queue again.
  const end = route.id === 'done' && (r.log.length || r.skipped.length);
  return { r, it: !end && r.i < r.keys.length ? resolve(r.keys[r.i]) : null };
}
function render(route) {
  if (!S.me) return empty({ title: 'No staff record yet', text: 'Ask your admin to add you.' });
  const { r, it } = current(route);
  if (!it) { r.done = true; return endScreen(r); }
  if (it.type === 'email') { S.tdAud ??= {}; const a = it.a; if (S.tdAud[a.id] === undefined) { S.tdAud[a.id] = null; DB.alertAudience(a.bill_id, a.list_id, a.segment_id).then(n => { S.tdAud[a.id] = n; if (S.route?.name === 'review') hooks.render(); }).catch(() => {}); } }
  const mine = actionable(it);
  return `<div class="td-rv">${header(r, r.keys.length)}
    ${mine ? '' : notice('info', 'info', it.type === 'email' ? 'This email is no longer waiting for your approval.' : `This draft is no longer waiting for you. It is ${esc({ draft: 'back in draft', review: 'waiting for an admin', second_review: 'waiting for a second approval', approved: 'approved and ready to file', filed: 'filed', cancelled: 'for a cancelled hearing' }[it.d.status] || it.d.status)}.`)}
    ${it.type === 'email' ? emailBody(it) : draftBody(it)}
    <p class="td-keys">Keys: A approve · R ${it.type === 'email' ? 'send back' : 'request changes'}${it.type === 'draft' ? ' · O open the Doc' : ''} · Right arrow skip · Esc close</p></div>`;
}
function bar(route) {
  const { it } = current(route);
  if (!it) return '';
  if (!actionable(it)) return btn('Next', { attrs: { 'data-skip': '1' }, iconEnd: 'chevron-right' });
  return `${btn(it.type === 'email' ? 'Send back' : 'Request changes', { kind: 'secondary', attrs: { 'data-changes': '1' } })}${btn('Approve', { icon: 'check', attrs: { 'data-approve': '1' } })}`;
}

// Moving on: record the decision, then load the next item in place (replaceState, so Back leaves review).
function advance(r, entry) {
  if (entry) r.log.push(entry); else if (!r.skipped.includes(r.keys[r.i])) r.skipped.push(r.keys[r.i]);
  r.i++;
  S.go(r.i < r.keys.length ? `#/review/${encodeURIComponent(r.keys[r.i])}` : '#/review/done', { replace: true });
}
const markNotices = billId => { const keys = (S.inbox || []).filter(i => i.direct && i.unread && i.bill_id === billId && i.kind !== 'message').map(i => i.key); if (keys.length) DB.inboxMark(keys).catch(() => {}); };
async function approve(route, el) {
  const { r, it } = current(route); if (!it || !actionable(it)) return;
  if (el) { el.setAttribute('aria-busy', 'true'); el.disabled = true; }
  try {
    if (it.type === 'email') {
      await DB.alertStep(it.a.id, 'approve');
      const msg = `Approved. ${first(it.a.author_id)} can send it now.`;
      toast(msg, { ok: true }); advance(r, { num: it.b ? `Email on ${billNum(it.b)}` : 'Email', what: msg, icon: 'check' });
      return;
    }
    await DB.transition(it.b.id, it.d.id, 'approve'); markNotices(it.b.id);
    // Written from the state the server returned: a first testimony goes on to second review.
    const d = resolve(it.key)?.d || it.d, filer = d.submitted_by ? (d.submitted_by === S.me.id ? null : first(d.submitted_by)) : first((S.assignments[it.b.id] || [])[0]);
    const msg = d.status === 'second_review' ? `Approved. Now needs ${reviewerNames()}.` : filer && filer !== 'Someone' ? `Approved. ${filer} will file it.` : 'Approved. Ready to file at the Capitol.';
    toast(msg, { ok: true }); advance(r, { num: billNum(it.b), what: msg, icon: 'check' });
  } catch (e) { toast(e, { err: true }); if (el && el.isConnected) { el.removeAttribute('aria-busy'); el.disabled = false; } }
}
// Request changes (or Send back, for an email): a note is required, so the writer knows what to fix.
function changes(route) {
  const { r, it } = current(route); if (!it || !actionable(it)) return;
  const to = first(it.type === 'email' ? it.a.author_id : it.d.submitted_by || (S.assignments[it.b.id] || [])[0]);
  const name = to === 'Someone' ? 'the writer' : to;
  openSheet({ title: 'What should change?', size: 'auto',
    body: `<div class="field"><textarea id="td-note" rows="4" aria-labelledby="sv-sh-t" aria-describedby="td-note-h" required autofocus></textarea><span class="help" id="td-note-h">${esc(name === 'the writer' ? 'The writer' : name)} sees this note with the ${it.type === 'email' ? 'email' : 'draft'}.</span></div>`,
    foot: btn(`Send back to ${esc(name)}`, { attrs: { 'data-send': '1' } }),
    wire: dlg => {
      const ta = dlg.querySelector('#td-note'), go = dlg.querySelector('[data-send]'); ta.focus();
      ta.oninput = () => { ta.removeAttribute('aria-invalid'); dlg.querySelector('#td-note-e')?.remove(); };
      go.onclick = async () => {
        const note = ta.value.trim();
        if (!note) { ta.setAttribute('aria-invalid', 'true'); if (!dlg.querySelector('#td-note-e')) ta.insertAdjacentHTML('afterend', `<span class="err" id="td-note-e" role="alert">${icon('circle-alert')}Write what should change first.</span>`); ta.setAttribute('aria-describedby', 'td-note-e td-note-h'); ta.focus(); return; }
        go.setAttribute('aria-busy', 'true'); go.disabled = true;
        try {
          if (it.type === 'email') await DB.alertStep(it.a.id, 'return', note);
          else { await DB.transition(it.b.id, it.d.id, 'request_changes', note); markNotices(it.b.id); }
          closeSheet({ silent: true }); await afterBack();
          const msg = `Sent back to ${name} with your note.`;
          toast(msg); advance(r, { num: it.type === 'email' ? (it.b ? `Email on ${billNum(it.b)}` : 'Email') : billNum(it.b), what: `Sent back: “${note.length > 80 ? note.slice(0, 78) + '…' : note}”`, icon: 'undo-2' });
        } catch (e) { toast(e, { err: true }); go.removeAttribute('aria-busy'); go.disabled = false; }
      };
    } });
}
function close() { if ((history.state?.d || 0) > 0) history.back(); else S.go('#/'); }

function wire(route, root) {
  const main = root.querySelector('main'); if (!main) return;
  root.querySelectorAll('[data-skip]').forEach(el => el.onclick = () => { const { r } = current(route); advance(r, null); });
  root.querySelector('[data-approve]')?.addEventListener('click', e => approve(route, e.currentTarget));
  root.querySelector('[data-changes]')?.addEventListener('click', () => changes(route));
  root.querySelector('[data-again]')?.addEventListener('click', () => { const keys = stillSkipped(S.tdRev); S.tdRev = { keys, i: 0, log: [], skipped: [], done: false }; S.go(`#/review/${encodeURIComponent(keys[0])}`, { replace: true }); });
  root.querySelector('[data-home]')?.addEventListener('click', () => { S.tdRev = null; });
}

// Desktop keys, only where there is a mouse to hover: A approve, R request changes, O open the Doc, Right arrow skip, Esc close.
document.addEventListener('keydown', e => {
  if (S.route?.name !== 'review' || !HOVER() || e.metaKey || e.ctrlKey || e.altKey || typing(e.target) || document.querySelector('dialog[open]')) return;
  const route = S.route, k = e.key.toLowerCase();
  if (k === 'escape') { e.preventDefault(); close(); return; }
  const { it } = current(route); if (!it) return;
  if (k === 'arrowright') { e.preventDefault(); document.querySelector('[data-skip]')?.click(); }
  else if (k === 'a') { e.preventDefault(); document.querySelector('[data-approve]')?.click(); }
  else if (k === 'r') { e.preventDefault(); document.querySelector('[data-changes]')?.click(); }
  else if (k === 'o' && it.type === 'draft' && it.d.doc_url) { e.preventDefault(); window.open(it.d.doc_url, '_blank', 'noopener'); }
});

export default {
  tab: 'today', tabs: false,
  // On phones the frame's back link (to Today) closes review; the page's own bar carries the title, the counter
  // and Skip, plus an × on desktop, where the frame hides its back link.
  back: () => ({ href: '#/', label: 'Today' }),
  title: () => 'Review',
  render, wire, bar,
};
