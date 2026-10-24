// Outreach > Emails (plan 3.9): the emails to supporters, grouped by what they need: Needs your approval, Ready to send,
// Drafts and sent back, Waiting on someone else, Sent (with its numbers). The same alerts and rules as the current
// app's Emails page (app.js renderEmails): an admin or an approver other than the writer approves (098), the writer (or an admin) sends,
// Postmark reports opens, clicks and bounces. Hearing alerts need nobody, so they get one line, not a card.
// Desktop (900px and wider): one table in the Bills table's look instead of the groups. It opens in the same order
// as the groups (what needs you first), every column sorts, and each row says its state three ways: a status chip
// with an icon and a word, a line under the subject that says what happens next, and the numbers once it is sent.
// Nothing on this page sends anything: a row only opens the email's own page.
// v3 (R-264): the second of Outreach's two tabs, Supporters · Emails. How approval works is said by each email's status,
// not by a sentence over the list, and the 4:30 PM email is explained where it matters, on the composer's Check it step.
// v4 (R-269): the third of Outreach's four tabs. "This week's asks" left this page for a tab of its own (asks.js), which
// Outreach opens on; it is said there once (A-14).
// v6 (R-336, spec 6): rows are a name and one line. A phone's groups use steps.js's row (the subject, then what happens
// next); a laptop's table keeps four columns, one fact each: Subject, Goes to, Where it stands (in words, bold when it is
// the viewer's step), Updated. The writer, the status chip and the numbers are on the email's own page.
import { S, esc, fmtDT, fmtDate, advocate } from './data.js';
import { alertsToReview } from './model.js';
import { icon, btn, empty, sectionNav } from './ui.js';
import { itemRow, nameWords, numWords } from './steps.js';
import { pageHead, isDesk, isSide, thSort, sortBy, wireTable, DASH, plural, shortDate } from './lists.js';
import { audienceOf, statusChip, approverNames, pausedNotice, ago, dailyWord, paused, heldNow, HELD, HELD_HEAD } from './composer.js';

const first = id => (advocate(id)?.full_name || 'Someone').split(' ')[0];
const when = a => a.updated_at || a.submitted_at || a.created_at || '';
const newest = (x, y) => String(when(y)).localeCompare(String(when(x)));

// "Followers of Let people cross during the countdown (HB 1523)", "Oʻahu testifiers": who it goes to, in one phrase.
const toWords = a => { const u = audienceOf(a); return u.b ? `Followers of ${nameWords(u.b, 1e4)}${u.b.nickname ? ` (${numWords(u.b)})` : ''}` : u.l ? `Followers of the list ${u.l.title}` : u.sg ? `The group ${u.sg.name}` : 'Nobody yet'; };
// A phone's row: the subject, then one line that says what happens next (marked when it is yours). Under a heading that
// already says it ("Yours to approve", "Ready to send", "Going out at 4:30 PM"), the line says who sent it, when, and who
// it goes to instead of the heading's words again (A-14).
// Short, so the row keeps to its one line: "to HB 1523's followers", "to the list Keiki health", "to the group Oʻahu testifiers".
const lowTo = a => { const u = audienceOf(a); return u.b ? `${u.name}’s followers` : u.l ? `the list ${u.l.title}` : u.sg ? `the group ${u.sg.name}` : 'nobody yet'; };
function groupLine(a, gid, rv) {
  if (gid === 'review') return { words: `${first(a.author_id)} sent it ${ago(a.submitted_at || when(a))} · to ${lowTo(a)}`, you: true };
  if (gid === 'send') return { words: `Approved ${ago(a.approved_at || when(a))} · to ${lowTo(a)}`, you: true };
  if (gid === 'going' && !heldNow(a)) return { words: `Goes out ${dailyWord(a.scheduled_for)} · to ${lowTo(a)}`, you: false };
  return nextWords(a, rv);
}
function emailRow(a, rv, gid) {
  const n = groupLine(a, gid, rv);
  return itemRow({ key: 'e:' + a.id, name: a.subject || '(no subject)', line: `<span class="le-next${n.you ? ' you' : ''}">${esc(n.words)}</span>`, href: '#/email/' + encodeURIComponent(a.id) });
}
const group = (id, title, rows, rv) => rows.length ? `<section class="le-egroup" aria-labelledby="le-g-${id}">
  <h2 class="le-gh" id="le-g-${id}">${title} <span class="le-gn">${rows.length}</span></h2>
  <div class="v6-list" role="list" aria-label="${esc(title)}">${rows.map(a => emailRow(a, rv, id)).join('')}</div></section>` : '';

// ---- desktop table ----
const COLS = [
  { k: 'subject', label: 'Subject', sort: 1 }, { k: 'to', label: 'Goes to', sort: 1 },
  { k: 'status', label: 'Where it stands', sort: 1, tip: 'Draft, sent back, waiting for approval, approved, then sent' }, { k: 'when', label: 'Updated', sort: -1, tip: 'When it last changed, or when it was sent' },
];
const STATUS_ORDER = { draft: 0, returned: 1, submitted: 2, approved: 3, sent: 4 };
const stamp = a => a.status === 'sent' ? a.sent_at || when(a) : when(a);
// R-316 W54 (FR-10): one time format in the column ("Mon 3/16"); the full day and time is the cell's tooltip.
const whenShort = iso => iso ? fmtDate(iso, { weekday: 'short' }).replace(/^(\w{3}),/, '$1') : '';
const colValue = (a, k) => k === 'subject' ? (a.subject || '').toLowerCase() : k === 'to' ? toWords(a).toLowerCase()
  : k === 'status' ? STATUS_ORDER[a.status] ?? 0 : k === 'when' ? stamp(a) || null : null;
// What happens next, in words, and whether it is the viewer's step (then it is said bold, first).
function nextWords(a, rv) {
  const me = S.me?.id, mine = a.author_id === me, who = first(a.author_id);
  if (heldNow(a)) return { words: mine ? HELD : `${HELD} (${who}’s)`, you: false };
  if (a.status === 'submitted') return rv.has(a.id) ? { words: 'Yours to approve', you: true } : { words: `Waiting for ${approverNames(a.author_id) || 'someone who approves'} to approve ${mine ? 'it' : who + '’s email'}`, you: false };
  if (a.status === 'approved' && a.scheduled_for) return { words: `Goes out ${dailyWord(a.scheduled_for)} at 4:30 PM`, you: false };
  if (a.status === 'approved') return mine ? { words: 'Approved: ready for you to send', you: true } : { words: `Approved: waiting for ${who} to send it`, you: false };
  if (a.status === 'returned') return mine ? { words: `Sent back to you${a.review_note ? `: “${a.review_note}”` : ''}`, you: true } : { words: `Sent back to ${who}`, you: false };
  if (a.status === 'sent') return { words: `Sent ${ago(a.sent_at)}, ${a.opens || 0} of ${a.recipients || 0} opened`, you: false };
  return mine ? { words: 'Your draft: finish it and send it for approval', you: true } : { words: `${who} is still writing it`, you: false };
}
function emailsTable(rows, v, rv) {
  const tr = a => { const href = '#/email/' + encodeURIComponent(a.id), n = nextWords(a, rv);
    return `<tr data-href="${esc(href)}">
      <td class="c-subject"><a class="le-tdname" href="${esc(href)}">${esc(a.subject || '(no subject)')}</a></td>
      <td class="c-to">${esc(toWords(a))}</td>
      <td class="c-status"><span class="le-next${n.you ? ' you' : ''}">${esc(n.words)}</span></td>
      <td class="c-when"${stamp(a) ? ` title="${esc(fmtDT(stamp(a)))}"` : ''}>${esc(whenShort(stamp(a))) || DASH}</td></tr>`; };
  return `<div class="le-twrap"><table class="le-table le-temails"><caption class="sr">Emails to supporters, ${plural(rows.length, 'email')}. Column headers sort. Select a subject to open that email.</caption>
    <thead><tr>${COLS.map(c => thSort(c, v.sort)).join('')}</tr></thead><tbody>${sortBy(rows, v.sort, colValue).map(tr).join('')}</tbody></table></div>`;
}

export default {
  tab: 'outreach',
  title: () => 'Emails',
  wide: () => true,
  render() {
    const v = S.leEmails ??= { sort: null };
    const all = (S.alerts || []).slice().sort(newest), me = S.me?.id;
    const review = alertsToReview().sort(newest), rv = new Set(review.map(a => a.id));
    // Ready to send: the writer's own approved emails. An admin can send someone else's too (from its page), but it
    // is the writer's to send, so those wait under "Waiting on someone else".
    const ready = all.filter(a => a.status === 'approved' && !a.scheduled_for && a.author_id === me);
    // Sent, waiting for the 4:30 PM email (R-101): its own group, so nobody wonders whether it went.
    const going = all.filter(a => a.status === 'approved' && a.scheduled_for);
    const drafts = all.filter(a => ['draft', 'returned'].includes(a.status)).sort((x, y) => (y.author_id === me) - (x.author_id === me) || (y.status === 'returned') - (x.status === 'returned') || newest(x, y));
    const waiting = all.filter(a => (a.status === 'submitted' && !rv.has(a.id)) || (a.status === 'approved' && !a.scheduled_for && a.author_id !== me));
    const sent = all.filter(a => a.status === 'sent').sort((x, y) => String(y.sent_at || '').localeCompare(String(x.sent_at || '')));
    // The page's one filled button is for the step you take now (A-3): an email waiting for you to approve or send keeps
    // "New email" tonal, so the eye goes to what is waiting.
    const newBtn = btn('New email', { kind: review.length + ready.length ? 'secondary' : 'primary', icon: 'mail-plus', href: '#/email/new' });
    const desk = isDesk(), needs = review.length + ready.length + drafts.filter(a => a.author_id === me).length;
    return `<div class="le-page ot-emails${desk ? ' le-desk' : ''}${isSide() ? ' le-side' : ''}">
      ${pageHead(sectionNav('outreach', 'emails'), 'Outreach', '', all.length ? newBtn : '')}
      ${pausedNotice()}
      ${!all.length ? `<div class="le-empty">${empty({ title: 'No emails yet', text: 'Write to the people who follow a bill or a list, or to a saved segment of supporters.', action: newBtn })}</div>`
        // The table opens in the groups' order (what needs you first, sent last); a header click re-sorts it.
        // With nothing waiting on you, no sentence floats over the table (the critic: it read as an empty state).
        : desk ? `${needs ? `<p class="le-tsum" aria-live="polite"><b>${needs} ${needs === 1 ? 'needs' : 'need'} you</b>${v.sort ? '' : ', listed first'}</p>` : ''}${emailsTable([...review, ...ready, ...going, ...drafts, ...waiting, ...sent], v, rv)}`
        : group('review', 'Yours to approve', review, rv)
        + group('send', 'Ready to send', ready, rv)
        + group('going', paused() ? HELD_HEAD : 'Going out at 4:30 PM', going, rv)
        + group('drafts', 'Drafts and sent back', drafts, rv)
        + group('wait', 'Waiting on someone else', waiting, rv)
        + group('sent', 'Sent', sent, rv)}
    </div>`;
  },
  wire(route, root) {
    wireTable(root, COLS, S.leEmails ??= { sort: null });
  },
};
