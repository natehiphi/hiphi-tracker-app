// Outreach > Emails (plan 3.9): the action alerts, grouped by what they need: Needs your approval, Ready to send,
// Drafts and sent back, Waiting on someone else, Sent (with its numbers). The same alerts and rules as the current
// app's Emails page (app.js renderEmails): an admin other than the writer approves, the writer (or an admin) sends,
// Postmark reports opens, clicks and bounces. Hearing alerts need nobody, so they get one line, not a card.
// Desktop (900px and wider): one table in the Bills table's look instead of the groups. It opens in the same order
// as the groups (what needs you first), every column sorts, and each row says its state three ways: a status chip
// with an icon and a word, a line under the subject that says what happens next, and the numbers once it is sent.
// Nothing on this page sends anything: a row only opens the email's own page.
import { S, esc, fmtDT, advocate } from './data.js';
import { alertsToReview } from './model.js';
import { icon, btn, row, empty } from './ui.js';
import { pageHead, isDesk, isSide, thSort, sortBy, wireTable, DASH, plural, shortDate } from './lists.js';
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

// ---- desktop table ----
const COLS = [
  { k: 'subject', label: 'Subject', sort: 1 }, { k: 'to', label: 'Goes to', sort: 1 }, { k: 'writer', label: 'Writer', sort: 1 },
  { k: 'status', label: 'Status', sort: 1, tip: 'Draft, sent back, waiting for approval, approved, then sent' }, { k: 'when', label: 'Updated', sort: -1, tip: 'When it last changed, or when it was sent' },
  { k: 'opens', label: 'Opened', sort: -1, num: true, tip: 'How many of the people it was sent to opened it' }, { k: 'clicks', label: 'Clicked', sort: -1, num: true, tip: 'How many clicked a link in it' },
];
const STATUS_ORDER = { draft: 0, returned: 1, submitted: 2, approved: 3, sent: 4 };
const stamp = a => a.status === 'sent' ? a.sent_at || when(a) : when(a);
// "12 min ago", "3h ago", then the date; the full day and time is the cell's tooltip.
const whenShort = iso => { if (!iso) return ''; const m = (Date.now() - new Date(iso)) / 6e4; return m < 24 * 60 ? ago(iso) : shortDate(iso); };
const colValue = (a, k) => k === 'subject' ? (a.subject || '').toLowerCase() : k === 'to' ? (audienceOf(a).name || '').toLowerCase() : k === 'writer' ? first(a.author_id).toLowerCase()
  : k === 'status' ? STATUS_ORDER[a.status] ?? 0 : k === 'when' ? stamp(a) || null : a.status === 'sent' ? a[k] || 0 : null;
// What happens next, in words; bold when the next step is the viewer's.
function nextLine(a, rv) {
  const me = S.me?.id, mine = a.author_id === me, who = esc(first(a.author_id));
  const you = (ic, t) => `<span class="le-next you">${icon(ic)}${t}</span>`, other = t => `<span class="le-next">${t}</span>`;
  if (a.status === 'submitted') return rv.has(a.id) ? you('user-check', 'Needs your approval') : other(`Waiting for ${esc(approverNames(a.author_id) || 'another admin')} to approve ${mine ? 'it' : who + '’s email'}`);
  if (a.status === 'approved') return mine ? you('send', 'Approved. Ready for you to send') : other(`Approved. Waiting for ${who} to send it`);
  if (a.status === 'returned') return mine ? you('undo-2', `Sent back to you${a.review_note ? `: “${esc(a.review_note)}”` : ''}`) : other(`Sent back to ${who}${a.review_note ? `: “${esc(a.review_note)}”` : ''}`);
  if (a.status === 'sent') return other(`Sent ${esc(ago(a.sent_at))}${a.bounces ? ` · ${a.bounces} bounced` : ''}`);
  return mine ? you('square-pen', 'Your draft. Finish it and send it for approval') : other(`${who} is still writing it`);
}
function emailsTable(rows, v, rv) {
  const tr = a => { const u = audienceOf(a), href = '#/email/' + encodeURIComponent(a.id), sent = a.status === 'sent', num = k => sent ? (a[k] || 0).toLocaleString() : DASH;
    const kind = u.kind === 'bill' ? 'Bill followers' : u.kind === 'list' ? 'List followers' : u.kind === 'segment' ? 'Saved segment' : '';
    return `<tr data-href="${esc(href)}">
      <td class="c-subject"><span class="le-tdbody"><a class="le-tdname" href="${esc(href)}">${esc(a.subject || '(no subject)')}</a><span class="le-tdsub">${nextLine(a, rv)}</span></span></td>
      <td class="c-to"><span class="le-tdlead sm">${icon(u.icon)}</span><span class="le-tdbody"><span class="le-l1">${u.b ? `<b>${esc(u.name)}</b>${u.b.nickname ? ' ' + esc(u.b.nickname) : ''}` : esc(u.name || 'Nobody yet')}</span>${kind ? `<span class="le-l2">${kind}</span>` : ''}</span></td>
      <td class="c-writer">${a.author_id === S.me?.id ? 'You' : esc(first(a.author_id))}</td>
      <td class="c-status">${statusChip(a)}</td>
      <td class="c-when"${stamp(a) ? ` title="${esc(fmtDT(stamp(a)))}"` : ''}>${esc(whenShort(stamp(a))) || DASH}</td>
      <td class="c-opens num">${sent ? `${num('opens')} <span class="le-of">of ${num('recipients')}</span>` : DASH}</td><td class="c-clicks num">${num('clicks')}</td></tr>`; };
  return `<div class="le-twrap"><table class="le-table le-temails"><caption class="sr">Emails to supporters, ${plural(rows.length, 'email')}. Column headers sort. Select a subject to open that email.</caption>
    <thead><tr>${COLS.map(c => thSort(c, v.sort)).join('')}</tr></thead><tbody>${sortBy(rows, v.sort, colValue).map(tr).join('')}</tbody></table></div>`;
}

export default {
  tab: 'outreach',
  title: () => 'Outreach',
  wide: () => true,
  render() {
    const v = S.leEmails ??= { sort: null };
    const all = (S.alerts || []).slice().sort(newest), me = S.me?.id;
    const review = alertsToReview().sort(newest), rv = new Set(review.map(a => a.id));
    // Ready to send: the writer's own approved emails. An admin can send someone else's too (from its page), but it
    // is the writer's to send, so those wait under "Waiting on someone else".
    const ready = all.filter(a => a.status === 'approved' && a.author_id === me);
    const drafts = all.filter(a => ['draft', 'returned'].includes(a.status)).sort((x, y) => (y.author_id === me) - (x.author_id === me) || (y.status === 'returned') - (x.status === 'returned') || newest(x, y));
    const waiting = all.filter(a => (a.status === 'submitted' && !rv.has(a.id)) || (a.status === 'approved' && a.author_id !== me));
    const sent = all.filter(a => a.status === 'sent').sort((x, y) => String(y.sent_at || '').localeCompare(String(x.sent_at || '')));
    const newBtn = btn('New email', { icon: 'mail-plus', href: '#/email/new' });
    const desk = isDesk(), needs = review.length + ready.length + drafts.filter(a => a.author_id === me).length;
    return `<div class="le-page${desk ? ' le-desk' : ''}${isSide() ? ' le-side' : ''}">
      ${pageHead('emails', 'Emails', desk ? 'Emails to supporters. An admin other than the writer approves each one before it can be sent.' : 'Emails to supporters. An admin approves each one.', all.length ? newBtn : '')}
      ${pausedNotice()}
      <p class="le-hear">${icon('bell')}<span>Hearing alerts send on their own, once a day, to people who asked for them.</span></p>
      ${!all.length ? `<div class="le-empty">${empty({ title: 'No emails yet', text: 'Write to the people who follow a bill or a list, or to a saved segment of supporters.', action: newBtn })}</div>`
        // The table opens in the groups' order (what needs you first, sent last); a header click re-sorts it.
        : desk ? `<p class="le-tsum" aria-live="polite"><b>${plural(all.length, 'email')}</b> · ${needs ? `${needs} ${needs === 1 ? 'needs' : 'need'} you` : 'none needs you'}${v.sort ? '' : ' · what needs you comes first'}</p>${emailsTable([...review, ...ready, ...drafts, ...waiting, ...sent], v, rv)}`
        : group('review', 'Needs your approval', review, 'review')
        + group('send', 'Ready to send', ready, 'send')
        + group('drafts', 'Drafts and sent back', drafts, 'draft')
        + group('wait', 'Waiting on someone else', waiting, 'wait')
        + group('sent', 'Sent', sent, 'sent')}
    </div>`;
  },
  wire(route, root) { wireTable(root, COLS, S.leEmails ??= { sort: null }); },
};
