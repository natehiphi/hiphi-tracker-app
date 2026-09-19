// Outreach > Emails (plan 3.9): the action alerts, grouped by what they need: Needs your approval, Ready to send,
// Drafts and sent back, Waiting on someone else, Sent (with its numbers). The same alerts and rules as the current
// app's Emails page (app.js renderEmails): an admin other than the writer approves, the writer (or an admin) sends,
// Postmark reports opens, clicks and bounces. Hearing alerts need nobody, so they get one line, not a card.
import { S, esc, advocate } from './data.js';
import { alertsToReview } from './model.js';
import { icon, btn, row, empty } from './ui.js';
import { outreachNav } from './lists.js';
import { audienceOf, statusChip, approverNames, pausedNotice, ago } from './composer.js';

const first = id => (advocate(id)?.full_name || 'Someone').split(' ')[0];
const when = a => a.updated_at || a.submitted_at || a.created_at || '';
const newest = (x, y) => String(when(y)).localeCompare(String(when(x)));
const toWhom = a => { const u = audienceOf(a); return u.kind === 'segment' ? `To ${u.name}` : `To followers of ${u.name || 'a bill'}`; };

function emailRow(a, kind) {
  const u = audienceOf(a), mine = a.author_id === S.me?.id;
  let sub, end = '';
  switch (kind) {
    case 'review': sub = `From ${esc(first(a.author_id))} · ${esc(toWhom(a))} · ${esc(ago(a.submitted_at || when(a)))}`; break;
    case 'send': sub = `Approved${a.approved_by ? ' by ' + esc(first(a.approved_by)) : ''} · ${esc(toWhom(a))}`; break;
    case 'draft': sub = a.status === 'returned' && a.review_note ? `<span class="le-rnote">“${esc(a.review_note)}”</span>` : `${mine ? 'You' : esc(first(a.author_id))} · ${esc(toWhom(a))} · ${esc(ago(when(a)))}`; end = statusChip(a); break;
    case 'wait': sub = a.status === 'approved' ? `Approved. Waiting for ${esc(first(a.author_id))} to send it.` : `Waiting for ${esc(approverNames(a.author_id) || 'another admin')} to approve ${mine ? 'it' : esc(first(a.author_id)) + '’s email'}.`; break;
    case 'sent': sub = `<span class="le-sline">Sent to ${a.recipients || 0} · ${a.opens || 0} opened · ${a.clicks || 0} clicked · ${a.bounces || 0} bounced</span><span class="le-smeta">${esc(u.name || '')} · ${esc(first(a.author_id))} · ${esc(ago(a.sent_at))}</span>`; break;
  }
  return row({ leadHtml: `<span class="lead">${icon(u.icon)}</span>`, title: esc(a.subject || '(no subject)'), sub, end, href: '#/email/' + encodeURIComponent(a.id), cls: 'le-erow' });
}
const group = (id, title, rows, kind) => rows.length ? `<section class="le-egroup" aria-labelledby="le-g-${id}">
  <h2 class="sv-group" id="le-g-${id}"><span>${title}</span><span class="n">${rows.length}</span></h2>
  <div class="rows">${rows.map(a => emailRow(a, kind)).join('')}</div></section>` : '';

export default {
  tab: 'outreach',
  title: () => 'Outreach',
  wide: () => true,
  render() {
    const all = (S.alerts || []).slice().sort(newest), me = S.me?.id;
    const review = alertsToReview().sort(newest), rv = new Set(review.map(a => a.id));
    // Ready to send: the writer's own approved emails. An admin can send someone else's too (from its page), but it
    // is the writer's to send, so those wait under "Waiting on someone else".
    const ready = all.filter(a => a.status === 'approved' && a.author_id === me);
    const drafts = all.filter(a => ['draft', 'returned'].includes(a.status)).sort((x, y) => (y.author_id === me) - (x.author_id === me) || (y.status === 'returned') - (x.status === 'returned') || newest(x, y));
    const waiting = all.filter(a => (a.status === 'submitted' && !rv.has(a.id)) || (a.status === 'approved' && a.author_id !== me));
    const sent = all.filter(a => a.status === 'sent').sort((x, y) => String(y.sent_at || '').localeCompare(String(x.sent_at || '')));
    const newBtn = btn('New email', { icon: 'mail-plus', href: '#/email/new' });
    return `<div class="le-page">
      <h1 class="le-h1">Emails</h1>
      ${outreachNav('emails')}
      <div class="le-tools"><p class="le-lede">Emails to supporters. An admin approves each one.</p>${all.length ? newBtn : ''}</div>
      ${pausedNotice()}
      <p class="le-hear">${icon('bell')}<span>Hearing alerts send on their own, once a day, to people who asked for them.</span></p>
      ${all.length ? group('review', 'Needs your approval', review, 'review')
        + group('send', 'Ready to send', ready, 'send')
        + group('drafts', 'Drafts and sent back', drafts, 'draft')
        + group('wait', 'Waiting on someone else', waiting, 'wait')
        + group('sent', 'Sent', sent, 'sent')
      : `<div class="le-empty">${empty({ title: 'No emails yet', text: 'Write to the people who follow a bill or a list, or to a saved segment of supporters.', action: newBtn })}</div>`}
    </div>`;
  },
  wire() {},
};
